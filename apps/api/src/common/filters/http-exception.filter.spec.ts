import { HttpExceptionFilter } from './http-exception.filter';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';

describe('HttpExceptionFilter & AllExceptionsFilter', () => {
  let httpFilter: HttpExceptionFilter;
  let allFilter: AllExceptionsFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: any;

  beforeEach(() => {
    httpFilter = new HttpExceptionFilter();
    allFilter = new AllExceptionsFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ method: 'POST', url: '/test-endpoint' }),
      }),
    };
  });

  describe('HttpExceptionFilter', () => {
    it('should format standard NotFoundException into clean JSON without stack trace', () => {
      const exception = new NotFoundException('Resource was not found');

      httpFilter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          error: 'NotFoundException',
          message: 'Resource was not found',
          path: '/test-endpoint',
        }),
      );
      const res = mockJson.mock.calls[0][0];
      expect(res.stack).toBeUndefined();
    });

    it('should format ValidationPipe BadRequestException message arrays cleanly', () => {
      const exception = new BadRequestException(['field1 is required', 'field2 must be string']);

      httpFilter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          error: 'BadRequestException',
          message: ['field1 is required', 'field2 must be string'],
          path: '/test-endpoint',
        }),
      );
    });
  });

  describe('AllExceptionsFilter', () => {
    it('should catch generic errors and return a safe 500 without leaking details', () => {
      const genericError = new Error('Database connection crashed: password=secret123');

      allFilter.catch(genericError, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred. Please try again later.',
          path: '/test-endpoint',
        }),
      );
      const res = mockJson.mock.calls[0][0];
      expect(res.stack).toBeUndefined();
      expect(JSON.stringify(res)).not.toContain('secret123');
    });

    it('should pass-through HttpExceptions to be handled by HttpExceptionFilter', () => {
      const httpEx = new BadRequestException('Bad input');

      allFilter.catch(httpEx, mockHost);

      // Should do nothing (letting HttpExceptionFilter catch it)
      expect(mockStatus).not.toHaveBeenCalled();
    });
  });
});

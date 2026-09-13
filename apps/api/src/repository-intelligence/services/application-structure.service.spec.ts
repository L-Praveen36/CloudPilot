import { ApplicationStructureService } from './application-structure.service';
import * as os from 'os';
import * as path from 'path';
import * as fsp from 'fs/promises';
import * as crypto from 'crypto';

describe('ApplicationStructureService (Phase 3.3)', () => {
  let service: ApplicationStructureService;
  let testWorkspace: string;

  beforeEach(async () => {
    service = new ApplicationStructureService();
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    testWorkspace = path.join(os.tmpdir(), `cp-struct-test-${randomSuffix}`);
    await fsp.mkdir(testWorkspace, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(testWorkspace, { recursive: true, force: true }).catch(() => {});
  });

  const writeFile = async (relativePath: string, content: string = '') => {
    const fullPath = path.join(testWorkspace, relativePath);
    await fsp.mkdir(path.dirname(fullPath), { recursive: true });
    await fsp.writeFile(fullPath, content);
  };

  // -------------------------------------------------------------------------
  // 1. Application Role Detection
  // -------------------------------------------------------------------------

  describe('Application Role Classification', () => {
    it('1. should detect Next.js application as FULLSTACK with entrypoint and scripts', async () => {
      await writeFile('package.json', JSON.stringify({
        name: 'next-fullstack',
        scripts: { build: 'next build', start: 'next start' },
        dependencies: { next: '^15.0.0', react: '^19.0.0' },
      }));
      await writeFile('app/page.tsx', 'export default function Page() { return <h1>Home</h1>; }');
      await writeFile('next.config.ts', 'export default {};');
      await writeFile('.env.example', 'PORT=3000\nDATABASE_URL=postgres://localhost:5432/db');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('FULLSTACK');
      expect(result.confidence).toBe('HIGH');
      expect(result.topLevelEntryPoint?.path).toBe('app/page.tsx');
      expect(result.topLevelBuildCommand?.command).toBe('npm run build');
      expect(result.topLevelBuildCommand?.isDeclared).toBe(true);
      expect(result.topLevelStartCommand?.command).toBe('npm start');
      expect(result.topLevelStartCommand?.isDeclared).toBe(true);
      expect(result.topLevelPort?.port).toBe(3000);
      expect(result.topLevelOutputDirectory?.path).toBe('.next');
    });

    it('2. should detect React/Vite application as FRONTEND', async () => {
      await writeFile('package.json', JSON.stringify({
        name: 'vite-client',
        scripts: { build: 'tsc && vite build', preview: 'vite preview' },
        dependencies: { react: '^18.2.0' },
        devDependencies: { vite: '^5.0.0' },
      }));
      await writeFile('index.html', '<div id="root"></div>');
      await writeFile('src/main.tsx', 'createRoot(document.getElementById("root")).render(<App />);');
      await writeFile('vite.config.ts', 'export default defineConfig({});');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('FRONTEND');
      expect(result.topLevelEntryPoint?.path).toBe('src/main.tsx');
      expect(result.topLevelPort?.port).toBe(5173);
      expect(result.topLevelOutputDirectory?.path).toBe('dist');
    });

    it('3. should detect NestJS backend application as API', async () => {
      await writeFile('package.json', JSON.stringify({
        name: 'nest-api',
        scripts: { build: 'nest build', start: 'node dist/main' },
        dependencies: { '@nestjs/core': '^11.0.0', '@nestjs/common': '^11.0.0' },
      }));
      await writeFile('nest-cli.json', '{}');
      await writeFile('src/main.ts', 'async function bootstrap() { const app = await NestFactory.create(AppModule); }');
      await writeFile('src/user.controller.ts', '@Controller("users") export class UserController {}');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('API');
      expect(result.topLevelEntryPoint?.path).toBe('src/main.ts');
      expect(result.topLevelPort?.port).toBe(3000);
      expect(result.topLevelOutputDirectory?.path).toBe('dist');
    });

    it('4. should detect Express server application as BACKEND', async () => {
      await writeFile('package.json', JSON.stringify({
        name: 'express-backend',
        scripts: { start: 'node server.js' },
        dependencies: { express: '^4.18.2' },
      }));
      await writeFile('server.js', 'const express = require("express"); const app = express(); app.listen(4000);');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('BACKEND');
      expect(result.topLevelEntryPoint?.path).toBe('server.js');
      expect(result.topLevelStartCommand?.command).toBe('npm start');
    });

    it('5. should detect Python FastAPI application as API', async () => {
      await writeFile('pyproject.toml', '[tool.poetry]\nname="api"\n[tool.poetry.dependencies]\nfastapi="^0.110.0"');
      await writeFile('main.py', 'from fastapi import FastAPI\napp = FastAPI()');
      await writeFile('.env.example', 'PORT=8000');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('API');
      expect(result.topLevelEntryPoint?.path).toBe('main.py');
      expect(result.topLevelPort?.port).toBe(8000);
    });

    it('6. should detect Python Django application as BACKEND', async () => {
      await writeFile('requirements.txt', 'django==5.0.2');
      await writeFile('manage.py', '#!/usr/bin/env python');
      await writeFile('mysite/settings.py', '');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('BACKEND');
      expect(result.topLevelEntryPoint?.path).toBe('manage.py');
    });

    it('7. should detect Java Spring Boot application as BACKEND with Maven build command', async () => {
      await writeFile('pom.xml', '<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>');
      await writeFile('src/main/java/com/cloudpilot/Application.java', '@SpringBootApplication public class Application { public static void main(String[] args) {} }');
      await writeFile('Dockerfile', 'FROM openjdk:17\nEXPOSE 8080');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('BACKEND');
      expect(result.topLevelEntryPoint?.path).toBe('src/main/java/com/cloudpilot/Application.java');
      expect(result.topLevelBuildCommand?.command).toBe('mvn package');
      expect(result.topLevelBuildCommand?.isDeclared).toBe(false);
      expect(result.topLevelPort?.port).toBe(8080);
      expect(result.topLevelOutputDirectory?.path).toBe('target');
    });

    it('8. should detect Go application as BACKEND with go build command', async () => {
      await writeFile('go.mod', 'module github.com/user/service\ngo 1.22');
      await writeFile('main.go', 'package main\nfunc main() {}');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('BACKEND');
      expect(result.topLevelEntryPoint?.path).toBe('main.go');
      expect(result.topLevelBuildCommand?.command).toBe('go build');
      expect(result.topLevelStartCommand?.command).toBe('go run .');
    });

    it('9. should detect Queue / Worker consumer as WORKER', async () => {
      await writeFile('package.json', JSON.stringify({
        name: 'email-worker',
        scripts: { start: 'node worker.js' },
        dependencies: { bullmq: '^5.0.0', ioredis: '^5.3.0' },
      }));
      await writeFile('worker.js', 'const { Worker } = require("bullmq");');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('WORKER');
    });

    it('10. should detect CLI utility as CLI', async () => {
      await writeFile('package.json', JSON.stringify({
        name: 'my-cli-tool',
        bin: { 'my-tool': './bin/run.js' },
      }));
      await writeFile('bin/run.js', '#!/usr/bin/env node\nconsole.log("cli");');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('CLI');
    });

    it('11. should detect Library package as LIBRARY when exports exist without start scripts', async () => {
      await writeFile('package.json', JSON.stringify({
        name: '@cloudpilot/shared-utils',
        main: './dist/index.js',
        module: './dist/index.mjs',
        exports: { '.': './dist/index.js' },
      }));
      await writeFile('src/index.ts', 'export const add = (a: number, b: number) => a + b;');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('LIBRARY');
    });

    it('12. should return UNKNOWN when repository is empty or unclassifiable', async () => {
      await writeFile('README.md', '# Documentation only');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('UNKNOWN');
      expect(result.topLevelEntryPoint).toBeNull();
      expect(result.topLevelBuildCommand).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Monorepo Multi-Application Discovery
  // -------------------------------------------------------------------------

  describe('Monorepo Multi-Application Discovery', () => {
    it('13. should discover sub-applications in apps/ and packages/ and map relationships', async () => {
      // Root workspace file
      await writeFile('pnpm-workspace.yaml', 'packages:\n  - "apps/*"\n  - "packages/*"');
      await writeFile('package.json', JSON.stringify({ name: 'monorepo-root', private: true }));

      // apps/web (React Vite frontend)
      await writeFile('apps/web/package.json', JSON.stringify({
        name: 'web-client',
        scripts: { build: 'vite build', start: 'vite preview' },
        dependencies: { react: '^18.2.0' },
        devDependencies: { vite: '^5.0.0' },
      }));
      await writeFile('apps/web/src/main.tsx', 'export function App() {}');
      await writeFile('apps/web/vite.config.ts', 'export default defineConfig({});');
      await writeFile('apps/web/.env.example', 'VITE_API_URL=http://localhost:3000');

      // apps/api (NestJS API backend)
      await writeFile('apps/api/package.json', JSON.stringify({
        name: 'api-server',
        scripts: { build: 'nest build', start: 'node dist/main' },
        dependencies: { '@nestjs/core': '^11.0.0' },
      }));
      await writeFile('apps/api/src/main.ts', 'async function bootstrap() {}');
      await writeFile('apps/api/nest-cli.json', '{}');
      await writeFile('apps/api/.env.example', 'PORT=3000');

      // packages/ui (shared library)
      await writeFile('packages/ui/package.json', JSON.stringify({
        name: '@org/ui',
        main: 'dist/index.js',
        dependencies: { react: '^18.2.0' },
      }));
      await writeFile('packages/ui/src/button.tsx', 'export const Button = () => null;');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('FULLSTACK');
      expect(result.applications.length).toBeGreaterThanOrEqual(2);

      const webApp = result.applications.find((a) => a.name === 'web');
      expect(webApp?.role).toBe('FRONTEND');
      expect(webApp?.framework).toBe('Vite');
      expect(webApp?.entryPoint?.path).toBe('apps/web/src/main.tsx');

      const apiApp = result.applications.find((a) => a.name === 'api');
      expect(apiApp?.role).toBe('API');
      expect(apiApp?.framework).toBe('NestJS');
      expect(apiApp?.entryPoint?.path).toBe('apps/api/src/main.ts');
      expect(apiApp?.port?.port).toBe(3000);

      // Check relationship mapping
      expect(result.relationships.length).toBeGreaterThanOrEqual(1);
      const rel = result.relationships.find((r) => r.source === 'web' && r.target === 'api');
      expect(rel).toBeDefined();
      expect(rel?.relationshipType).toBe('CLIENT_SERVER');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Port Detection Sources
  // -------------------------------------------------------------------------

  describe('Port Detection Sources', () => {
    it('14. should detect port from .env.example', async () => {
      await writeFile('.env.example', 'DATABASE_URL=postgres://...\nPORT=4000');
      await writeFile('package.json', JSON.stringify({ name: 'app' }));
      await writeFile('server.js', '');

      const result = await service.detectStructure(testWorkspace);

      expect(result.topLevelPort?.port).toBe(4000);
      expect(result.topLevelPort?.confidence).toBe('HIGH');
    });

    it('15. should detect port from Dockerfile EXPOSE', async () => {
      await writeFile('Dockerfile', 'FROM node:20-alpine\nEXPOSE 8080\nCMD ["node", "app.js"]');
      await writeFile('package.json', JSON.stringify({ name: 'app' }));
      await writeFile('app.js', '');

      const result = await service.detectStructure(testWorkspace);

      expect(result.topLevelPort?.port).toBe(8080);
      expect(result.topLevelPort?.confidence).toBe('HIGH');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Security & Determinism
  // -------------------------------------------------------------------------

  describe('Security & Determinism', () => {
    it('16. should NEVER expose contents or values from real secret .env files', async () => {
      await writeFile('.env', 'DATABASE_PASSWORD=super_secret_production_password_12345\nPORT=9999');
      await writeFile('.env.example', 'PORT=3000');
      await writeFile('package.json', JSON.stringify({ name: 'app' }));
      await writeFile('server.js', '');

      const result = await service.detectStructure(testWorkspace);
      const resultStr = JSON.stringify(result);

      expect(resultStr).not.toContain('super_secret_production_password_12345');
      expect(resultStr).not.toContain('DATABASE_PASSWORD');
      expect(result.topLevelPort?.port).toBe(3000); // from .env.example, not .env
    });

    it('17. should produce identical structure results when run multiple times (Determinism)', async () => {
      await writeFile('package.json', JSON.stringify({
        name: 'det-app',
        scripts: { build: 'next build', start: 'next start' },
        dependencies: { next: '^15.0.0', react: '^19.0.0' },
      }));
      await writeFile('app/page.tsx', '');
      await writeFile('next.config.ts', '');
      await writeFile('.env.example', 'PORT=3000');

      const run1 = await service.detectStructure(testWorkspace);
      const run2 = await service.detectStructure(testWorkspace);

      expect(run1).toEqual(run2);
      expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
    });

    it('18. should ignore node_modules and .git directories', async () => {
      await writeFile('node_modules/express/index.js', '');
      await writeFile('.git/config', '');
      await writeFile('main.py', 'print("hello")');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('BACKEND');
      expect(result.topLevelEntryPoint?.path).toBe('main.py');
    });

    it('19. should detect Create React App output directory as build and Express port from source code', async () => {
      // client/
      await writeFile('client/package.json', JSON.stringify({
        name: 'client-app',
        scripts: { build: 'react-scripts build', start: 'react-scripts start' },
        dependencies: { react: '^18.0.0', 'react-scripts': '5.0.1' },
      }));
      await writeFile('client/src/index.js', 'console.log("react");');

      // server/
      await writeFile('server/package.json', JSON.stringify({
        name: 'server-app',
        scripts: { start: 'node index.js' },
        dependencies: { express: '^4.18.0' },
      }));
      await writeFile('server/index.js', 'const express = require("express"); const app = express(); const PORT = process.env.PORT || 5000; app.listen(PORT);');

      const result = await service.detectStructure(testWorkspace);

      expect(result.primaryRole).toBe('FULLSTACK');
      const clientApp = result.applications.find((a) => a.name === 'client');
      expect(clientApp?.outputDirectory?.path).toBe('build');
      expect(clientApp?.outputDirectory?.source).toContain('react-scripts');

      const serverApp = result.applications.find((a) => a.name === 'server');
      expect(serverApp?.port?.port).toBe(5000);
      expect(serverApp?.port?.source).toContain('index.js');

      // Top level port in FULLSTACK must prioritize backend server port
      expect(result.topLevelPort?.port).toBe(5000);
    });

    it('20. should detect required environment variables without fallbacks and optional ones with fallbacks', async () => {
      await writeFile('server/package.json', JSON.stringify({
        name: 'server-app',
        scripts: { start: 'node index.js' },
      }));
      await writeFile('server/index.js', `
        const OpenAI = require("openai");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const PORT = process.env.PORT || 5000;
        const NODE_ENV = process.env.NODE_ENV || 'development';
      `);

      const result = await service.detectStructure(testWorkspace);

      expect(result.detectedEnvironmentVariables).toBeDefined();
      const openaiKey = result.detectedEnvironmentVariables?.find((v) => v.name === 'OPENAI_API_KEY');
      expect(openaiKey).toBeDefined();
      expect(openaiKey?.required).toBe(true);
      expect(openaiKey?.confidence).toBe('HIGH');

      const portVar = result.detectedEnvironmentVariables?.find((v) => v.name === 'PORT');
      expect(portVar).toBeDefined();
      expect(portVar?.required).toBe(false);

      const nodeEnvVar = result.detectedEnvironmentVariables?.find((v) => v.name === 'NODE_ENV');
      expect(nodeEnvVar).toBeDefined();
      expect(nodeEnvVar?.required).toBe(false);
    });
  });
});

import { RepositoryAnalyzerService } from './repository-analyzer.service';
import * as os from 'os';
import * as path from 'path';
import * as fsp from 'fs/promises';
import * as crypto from 'crypto';

describe('RepositoryAnalyzerService (Phase 3.2)', () => {
  let service: RepositoryAnalyzerService;
  let testWorkspace: string;

  beforeEach(async () => {
    service = new RepositoryAnalyzerService();
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    testWorkspace = path.join(os.tmpdir(), `cp-analyzer-test-${randomSuffix}`);
    await fsp.mkdir(testWorkspace, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(testWorkspace, { recursive: true, force: true }).catch(() => {});
  });

  // Helper to write files into test workspace
  const writeFile = async (relativePath: string, content: string = '') => {
    const fullPath = path.join(testWorkspace, relativePath);
    await fsp.mkdir(path.dirname(fullPath), { recursive: true });
    await fsp.writeFile(fullPath, content);
  };

  // -------------------------------------------------------------------------
  // 1. JavaScript & TypeScript Framework Detection
  // -------------------------------------------------------------------------

  describe('JavaScript / TypeScript Web Applications', () => {
    it('1. should detect Next.js application with TypeScript and npm', async () => {
      await writeFile('package.json', JSON.stringify({
        dependencies: { next: '^15.0.0', react: '^19.0.0' },
      }));
      await writeFile('package-lock.json', '{}');
      await writeFile('tsconfig.json', '{}');
      await writeFile('next.config.ts', 'export default {};');
      await writeFile('app/page.tsx', 'export default function Page() {}');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('WEB_APPLICATION');
      expect(result.primaryLanguage).toBe('TypeScript');
      expect(result.framework).toBe('Next.js');
      expect(result.packageManager).toBe('npm');
      expect(result.isMonorepo).toBe(false);
      expect(result.detectedFiles).toContain('package.json');
      expect(result.detectedFiles).toContain('next.config.ts');
      expect(result.detectedFiles).toContain('tsconfig.json');
    });

    it('2. should detect NestJS application with pnpm', async () => {
      await writeFile('package.json', JSON.stringify({
        dependencies: { '@nestjs/core': '^11.0.0', '@nestjs/common': '^11.0.0' },
      }));
      await writeFile('pnpm-lock.yaml', 'lockfileVersion: 5.4');
      await writeFile('nest-cli.json', '{}');
      await writeFile('src/main.ts', 'import { NestFactory } from "@nestjs/core";');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('WEB_APPLICATION');
      expect(result.primaryLanguage).toBe('TypeScript');
      expect(result.framework).toBe('NestJS');
      expect(result.packageManager).toBe('pnpm');
    });

    it('3. should detect Vite + React application with yarn', async () => {
      await writeFile('package.json', JSON.stringify({
        dependencies: { react: '^18.2.0' },
        devDependencies: { vite: '^5.0.0' },
      }));
      await writeFile('yarn.lock', '');
      await writeFile('vite.config.ts', 'export default {};');
      await writeFile('src/App.tsx', 'export function App() {}');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('WEB_APPLICATION');
      expect(result.primaryLanguage).toBe('TypeScript');
      expect(result.framework).toBe('Vite');
      expect(result.packageManager).toBe('yarn');
    });

    it('4. should detect Angular application', async () => {
      await writeFile('package.json', JSON.stringify({
        dependencies: { '@angular/core': '^17.0.0' },
      }));
      await writeFile('angular.json', '{}');
      await writeFile('src/app/app.component.ts', '@Component({})');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('WEB_APPLICATION');
      expect(result.framework).toBe('Angular');
    });

    it('5. should detect Express backend application in JavaScript', async () => {
      await writeFile('package.json', JSON.stringify({
        dependencies: { express: '^4.18.2' },
      }));
      await writeFile('index.js', 'const express = require("express");');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('WEB_APPLICATION');
      expect(result.primaryLanguage).toBe('JavaScript');
      expect(result.framework).toBe('Express');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Python Applications
  // -------------------------------------------------------------------------

  describe('Python Applications', () => {
    it('6. should detect FastAPI application with Poetry', async () => {
      await writeFile('pyproject.toml', `
[tool.poetry]
name = "fastapi-app"
[tool.poetry.dependencies]
fastapi = "^0.110.0"
      `);
      await writeFile('poetry.lock', '');
      await writeFile('main.py', 'from fastapi import FastAPI\napp = FastAPI()');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('PYTHON_APPLICATION');
      expect(result.primaryLanguage).toBe('Python');
      expect(result.framework).toBe('FastAPI');
      expect(result.packageManager).toBe('poetry');
    });

    it('7. should detect Django application with requirements.txt and pip', async () => {
      await writeFile('requirements.txt', 'django==5.0.2\npsycopg2-binary==2.9.9');
      await writeFile('manage.py', '#!/usr/bin/env python');
      await writeFile('mysite/settings.py', '');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('PYTHON_APPLICATION');
      expect(result.primaryLanguage).toBe('Python');
      expect(result.framework).toBe('Django');
      expect(result.packageManager).toBe('pip');
      expect(result.detectedFiles).toContain('manage.py');
    });

    it('8. should detect Flask application with Pipfile', async () => {
      await writeFile('Pipfile', '[packages]\nflask = "*"');
      await writeFile('requirements.txt', 'flask>=3.0.0');
      await writeFile('app.py', 'from flask import Flask\napp = Flask(__name__)');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('PYTHON_APPLICATION');
      expect(result.primaryLanguage).toBe('Python');
      expect(result.framework).toBe('Flask');
      expect(result.packageManager).toBe('pipenv');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Java & Go Applications
  // -------------------------------------------------------------------------

  describe('Java & Go Applications', () => {
    it('9. should detect Spring Boot application with Maven (pom.xml)', async () => {
      await writeFile('pom.xml', `
<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
  </dependencies>
</project>
      `);
      await writeFile('src/main/java/com/example/App.java', 'public class App {}');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('JAVA_APPLICATION');
      expect(result.primaryLanguage).toBe('Java');
      expect(result.framework).toBe('Spring Boot');
      expect(result.packageManager).toBe('maven');
    });

    it('10. should detect Java Gradle application (build.gradle.kts)', async () => {
      await writeFile('build.gradle.kts', 'plugins { id("org.springframework.boot") }');
      await writeFile('src/main/java/Application.java', '');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('JAVA_APPLICATION');
      expect(result.primaryLanguage).toBe('Java');
      expect(result.packageManager).toBe('gradle');
    });

    it('11. should detect Go module application (go.mod)', async () => {
      await writeFile('go.mod', 'module github.com/user/service\n\ngo 1.22');
      await writeFile('main.go', 'package main\nfunc main() {}');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('GO_APPLICATION');
      expect(result.primaryLanguage).toBe('Go');
      expect(result.framework).toBe('Go');
      expect(result.packageManager).toBe('go');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Docker & Monorepo Detection
  // -------------------------------------------------------------------------

  describe('Docker & Monorepo Detection', () => {
    it('12. should detect Docker-only repository when no higher-priority manifest exists', async () => {
      await writeFile('Dockerfile', 'FROM alpine:latest\nCMD ["echo", "hello"]');
      await writeFile('docker-compose.yml', 'version: "3"');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('DOCKER_APPLICATION');
      expect(result.hasDockerfile).toBe(true);
      expect(result.hasDockerCompose).toBe(true);
      expect(result.primaryLanguage).toBe('Dockerfile');
    });

    it('13. should detect monorepo from pnpm-workspace.yaml', async () => {
      await writeFile('pnpm-workspace.yaml', 'packages:\n  - "apps/*"\n  - "packages/*"');
      await writeFile('apps/web/package.json', '{}');
      await writeFile('packages/ui/package.json', '{}');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.isMonorepo).toBe(true);
      expect(result.packageManager).toBe('pnpm');
    });

    it('14. should detect monorepo from turbo.json', async () => {
      await writeFile('package.json', JSON.stringify({ name: 'my-turbo-repo' }));
      await writeFile('turbo.json', '{}');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.isMonorepo).toBe(true);
    });

    it('15. should detect monorepo from package.json workspaces array', async () => {
      await writeFile('package.json', JSON.stringify({
        name: 'workspace-root',
        workspaces: ['apps/*', 'packages/*'],
      }));

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.isMonorepo).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Language Weighting & Directory Filtering
  // -------------------------------------------------------------------------

  describe('Language Weighting & Directory Filtering', () => {
    it('16. should correctly weight TypeScript when TS files outnumber JS files', async () => {
      await writeFile('src/a.ts', '');
      await writeFile('src/b.ts', '');
      await writeFile('src/c.tsx', '');
      await writeFile('legacy.js', '');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.primaryLanguage).toBe('TypeScript');
    });

    it('17. should ignore node_modules, .git, dist, and .next directories', async () => {
      await writeFile('node_modules/lodash/index.js', '');
      await writeFile('dist/bundle.js', '');
      await writeFile('.next/server.js', '');
      await writeFile('src/main.py', 'print("hello")');

      const result = await service.analyzeWorkspace(testWorkspace);

      // Node_modules / dist / .next files should not make JS the primary language
      expect(result.primaryLanguage).toBe('Python');
      expect(result.projectType).toBe('PYTHON_APPLICATION');
      expect(result.detectedFiles).not.toContain('node_modules/lodash/index.js');
    });

    it('18. should detect .env.example flag without reading secret .env file', async () => {
      await writeFile('.env.example', 'DATABASE_URL=postgres://...\nPORT=3000');
      await writeFile('.env', 'DATABASE_URL=postgres://real_password@localhost:5432/db');
      await writeFile('index.js', '');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.hasEnvExample).toBe(true);
      expect(result.detectedFiles).toContain('.env.example');
      // .env must never be in detectedFiles
      expect(result.detectedFiles).not.toContain('.env');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Edge Cases & Robustness
  // -------------------------------------------------------------------------

  describe('Edge Cases & Malformed Files', () => {
    it('19. should return UNKNOWN for empty repository without crashing', async () => {
      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('UNKNOWN');
      expect(result.primaryLanguage).toBeNull();
      expect(result.framework).toBeNull();
      expect(result.packageManager).toBeNull();
      expect(result.detectedFiles).toEqual([]);
    });

    it('20. should gracefully handle malformed package.json', async () => {
      await writeFile('package.json', '{ this is not valid json ');
      await writeFile('src/index.ts', 'const x: number = 1;');

      const result = await service.analyzeWorkspace(testWorkspace);

      expect(result.projectType).toBe('WEB_APPLICATION');
      expect(result.primaryLanguage).toBe('TypeScript');
      expect(result.framework).toBeNull(); // fallback cleanly
    });

    it('21. should sort detectedFiles alphabetically', async () => {
      await writeFile('tsconfig.json', '{}');
      await writeFile('package.json', '{}');
      await writeFile('Dockerfile', '');
      await writeFile('.env.example', '');

      const result = await service.analyzeWorkspace(testWorkspace);

      const expected = ['.env.example', 'Dockerfile', 'package.json', 'tsconfig.json'].sort();
      expect(result.detectedFiles).toEqual(expected);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Determinism Property Test
  // -------------------------------------------------------------------------

  describe('Determinism & Property Test', () => {
    it('22. identical workspace snapshot must produce identical analysis results across multiple runs', async () => {
      await writeFile('package.json', JSON.stringify({
        dependencies: { next: '^15.0.0', react: '^19.0.0' },
      }));
      await writeFile('pnpm-lock.yaml', '');
      await writeFile('tsconfig.json', '{}');
      await writeFile('next.config.js', 'module.exports = {};');
      await writeFile('.env.example', 'KEY=VAL');
      await writeFile('Dockerfile', 'FROM node:20');
      await writeFile('src/index.tsx', '');
      await writeFile('src/utils.ts', '');

      const run1 = await service.analyzeWorkspace(testWorkspace);
      const run2 = await service.analyzeWorkspace(testWorkspace);

      expect(run1).toEqual(run2);
      expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
    });
  });

  // -------------------------------------------------------------------------
  // 8. Backward-Compatible analyze() In-Memory Helper
  // -------------------------------------------------------------------------

  describe('analyze() in-memory helper', () => {
    it('23. in-memory analyze() works with AnalysisInput', () => {
      const result = service.analyze({
        filePaths: ['package.json', 'tsconfig.json', 'next.config.ts', 'app/page.tsx'],
        manifests: {
          packageJson: { dependencies: { next: '^15.0.0' } },
        },
      });

      expect(result.projectType).toBe('WEB_APPLICATION');
      expect(result.framework).toBe('Next.js');
      expect(result.primaryLanguage).toBe('TypeScript');
    });
  });
});

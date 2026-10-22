import type { INestApplication } from '@nestjs/common';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';

// JSON body limits (validate-health-connect-data design decision 3): the
// temporary Health Connect intake accepts 10 MB, since a first sync carries
// up to 48 hours of every enabled type; every other route keeps Express's
// 100 kB. Called before the application initialises, so Nest, finding a JSON
// parser applied, adds none of its own.

const INTAKE_PATH = /^\/health-connect\/deliveries\/?$/;

const intakeParser = express.json({ limit: '10mb' });

/** Applies the API's JSON body parsers; `main.ts` calls it before `listen`. */
export const useBodyParsers = (app: INestApplication): void => {
  // Express matches `use` paths by prefix, while its routing ignores a
  // trailing slash, so the intake's path is matched here exactly.
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.method === 'POST' && INTAKE_PATH.test(request.path)) {
      intakeParser(request, response, next);
    } else {
      next();
    }
  });
  // A body the intake's parser read is skipped here.
  app.use(express.json({ limit: '100kb' }));
};

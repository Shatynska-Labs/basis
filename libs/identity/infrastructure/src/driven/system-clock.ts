import { Clock } from '@basis/identity-application';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

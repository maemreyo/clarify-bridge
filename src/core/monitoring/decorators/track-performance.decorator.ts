// Updated: Performance tracking decorator

import { Inject } from '@nestjs/common';
import { MonitoringService } from '../monitoring.service';

export function TrackPerformance(operation?: string) {
  const injectMonitoring = Inject(MonitoringService);

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    injectMonitoring(target, 'monitoringService');

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const monitoringService = this.monitoringService as MonitoringService;
      const operationName = operation || `${target.constructor.name}.${propertyKey}`;

      return monitoringService.trackPerformance(
        operationName,
        () => originalMethod.apply(this, args),
      );
    };

    return descriptor;
  };
}

// ============================================
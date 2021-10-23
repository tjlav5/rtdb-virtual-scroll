import { DataSource } from '@angular/cdk/collections/data-source';
import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { of } from 'rxjs';

@Injectable()
export class RtdbViewerStore
  extends ComponentStore<{}>
  implements DataSource<{}>
{
  constructor() {
    super({});
  }

  connect() {
    return of([]);
  }

  disconnect() {}
}

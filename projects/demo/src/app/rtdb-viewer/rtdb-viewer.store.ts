import { DataSource } from '@angular/cdk/collections/data-source';
import { Injectable } from '@angular/core';
import { DatabaseReference } from '@firebase/database';
import { ComponentStore } from '@ngrx/component-store';
import { of } from 'rxjs';
import { concatMap, map, tap } from 'rxjs/operators';
import { object } from 'rxfire/database';

interface State {
  rootRef: DatabaseReference | undefined;
}

const INITIAL_STATE: State = {
  rootRef: undefined,
}

@Injectable()
export class RtdbViewerStore
  extends ComponentStore<State>
  implements DataSource<{}>
{
  constructor() {
    super(INITIAL_STATE);
  }

  readonly rootRef$ = this.select(state => state.rootRef);

  readonly setRootRef = this.updater((state, rootRef: DatabaseReference | undefined) => ({
    ...state,
    rootRef,
  }));

  connect() {
    return this.rootRef$.pipe(
      concatMap((ref) => object(ref)),
      map(change => change.snapshot.val()),
      tap((data) => {
        console.log({data});
      }),
      map(() => [{foo: 'bar'}]),
    );
  }

  disconnect() { }
}

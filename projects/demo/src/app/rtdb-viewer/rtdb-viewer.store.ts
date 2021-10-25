import { DataSource } from '@angular/cdk/collections/data-source';
import { Injectable } from '@angular/core';
import { DatabaseReference, DataSnapshot } from '@firebase/database';
import { ComponentStore } from '@ngrx/component-store';
import { of } from 'rxjs';
import { catchError, concatMap, map, tap } from 'rxjs/operators';
import { object } from 'rxfire/database';

interface State {
  rootRef: DatabaseReference | undefined;
}

const INITIAL_STATE: State = {
  rootRef: undefined,
}

type JsonPrimitive = string | number | boolean | null;

type Json =
  | JsonPrimitive
  | { [property: string]: Json }
  | Json[];

export type FlatSnapshot = [DatabaseReference, JsonPrimitive];

@Injectable()
export class RtdbViewerStore
  extends ComponentStore<State>
  implements DataSource<[DatabaseReference, JsonPrimitive]>
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
      map(({ snapshot }) => {
        console.log({ data: snapshot.val() });
        const flatSnapshot = flattenSnapshot(snapshot);
        console.log({ flatSnapshot: flatSnapshot })
        return flatSnapshot;
      }),
      catchError((err, caught) => {
        console.error(err);
        return caught;
      })
    );
  }

  disconnect() { }
}

function flattenSnapshot(snapshot: DataSnapshot): FlatSnapshot[] {
  if (snapshot.hasChildren()) {
    const children: Array<FlatSnapshot[]> = [];
    snapshot.forEach(s => {
      children.push(flattenSnapshot(s));
    });
    return children.flat();
  } else {
    return [[snapshot.ref, snapshot.val()]];
  }
}
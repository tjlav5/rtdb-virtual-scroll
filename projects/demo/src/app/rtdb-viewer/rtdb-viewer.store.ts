import { DataSource } from '@angular/cdk/collections/data-source';
import { Injectable } from '@angular/core';
import { DatabaseReference, DataSnapshot } from '@firebase/database';
import { ComponentStore } from '@ngrx/component-store';
import { combineLatest, of } from 'rxjs';
import { catchError, concatMap, map, shareReplay, tap } from 'rxjs/operators';
import { object } from 'rxfire/database';

interface State {
  rootRef: DatabaseReference | undefined;
  query: string | undefined;
}

const INITIAL_STATE: State = {
  rootRef: undefined,
  query: undefined,
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
  readonly query$ = this.select(state => state.query);

  readonly setRootRef = this.updater((state, rootRef: DatabaseReference | undefined) => ({
    ...state,
    rootRef,
  }));

  readonly setQuery = this.updater((state, query: string) => ({
    ...state,
    query,
  }))

  private readonly flatSnapshot$ = this.rootRef$.pipe(
    concatMap((ref) => object(ref)),
    map(({ snapshot }) => {
      console.log({ data: snapshot.val() });
      const t0 = performance.now();
      const flatSnapshot = flattenSnapshot(snapshot);
      const t1 = performance.now();
      console.log({ flatSnapshot: flatSnapshot, time: t1 - t0 })
      return flatSnapshot;
    }),
    catchError((err, caught) => {
      console.error(err);
      // TODO - fallback to Rest API
      return caught;
    }),
    // map to UI node(s) + insert editor formControls OR save-sentinels
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly queryResults$ = combineLatest([this.flatSnapshot$, this.query$]).pipe(
    map(([flatSnapshot, query]) => {
      const t0 = performance.now();
      if (!query) {
        return [];
      }

      const indicies: number[] = [];
      for (let i = 0; i < flatSnapshot.length; i++) {
        const [ref, val] = flatSnapshot[i];
        if (ref.toString().includes(query) || val.toString().includes(query)) {
          indicies.push(i);
        }
      }
      const t1 = performance.now();
      console.log({ queryResultsCount: indicies.length, time: t1 - t0 })

      return indicies;
    }),
  );

  connect() {
    return this.flatSnapshot$;
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
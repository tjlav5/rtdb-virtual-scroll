import { DataSource } from '@angular/cdk/collections/data-source';
import { Injectable } from '@angular/core';
import { DatabaseReference, DataSnapshot } from '@firebase/database';
import { ComponentStore } from '@ngrx/component-store';
import { combineLatest, of } from 'rxjs';
import { catchError, concatMap, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { object } from 'rxfire/database';

interface State {
  rootRef: DatabaseReference | undefined;
  query: string | undefined;
  collapsedRefs: Set<string>;
}

const INITIAL_STATE: State = {
  rootRef: undefined,
  query: undefined,
  collapsedRefs: new Set(),
}

export type JsonPrimitive = string | number | boolean | null;

export type Json =
  | JsonPrimitive
  | { [property: string]: Json }
  | Json[];

export type FlatSnapshot = [DatabaseReference, JsonPrimitive];

export interface RtdbNode {
  ref: DatabaseReference;
  value?: JsonPrimitive;
}

@Injectable()
export class RtdbViewerStore
  extends ComponentStore<State>
  implements DataSource<RtdbNode>
{
  constructor() {
    super(INITIAL_STATE);
  }

  readonly rootRef$ = this.select(state => state.rootRef);
  readonly query$ = this.select(state => state.query);
  readonly collapsedRefs$ = this.select(state => state.collapsedRefs);

  readonly setRootRef = this.updater((state, rootRef: DatabaseReference | undefined) => ({
    ...state,
    rootRef,
    collapsedRefs: new Set(),
  }));

  readonly setQuery = this.updater((state, query: string) => ({
    ...state,
    query,
  }));
  
  readonly expandNode = this.updater((state, ref: DatabaseReference) => {
    const collapsedRefs = new Set(state.collapsedRefs);
    collapsedRefs.delete(ref.toString());

    return {
    ...state,
    collapsedRefs,
    };
  });

  readonly collapseNode = this.updater((state, ref: DatabaseReference) => ({
    ...state,
    collapsedRefs: new Set([...state.collapsedRefs, ref.toString()]),
  }));

  private readonly flatSnapshot$ = 
  combineLatest([this.rootRef$, this.collapsedRefs$]).pipe(
    switchMap(([ref, collapsedRefs]) => {
      return object(ref).pipe(
        map(({ snapshot }) => {
          console.log(ref, collapsedRefs);
          console.log({ data: snapshot.val() });
          const t0 = performance.now();
          const flatSnapshot = flattenSnapshot(snapshot, collapsedRefs);
          const t1 = performance.now();
          console.log({ flatSnapshot: flatSnapshot, time: t1 - t0 })
          return flatSnapshot;
        }));
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
    return this.flatSnapshot$.pipe(
      map(flatSnapshot => {
        const rtdbNodes: RtdbNode[] = [];
        for (const [ref, value] of flatSnapshot) {
          rtdbNodes.push({
            ref,
            value,
          });
        }
        return rtdbNodes;
      }),
    );
  }

  disconnect() { }
}

function flattenSnapshot(snapshot: DataSnapshot, collapsedRefs: Set<string>): FlatSnapshot[] {
  if (snapshot.hasChildren()) {
    const children: Array<FlatSnapshot[]> = [];

    if (!collapsedRefs.has(snapshot.ref.toString())) {
      snapshot.forEach(s => {
        children.push(flattenSnapshot(s, collapsedRefs));
      });
    } else {
      console.log(`flatten ${snapshot.ref}`);
    }

    return [[snapshot.ref, null], ...children.flat()];
  } else {
    return [[snapshot.ref, snapshot.val()]];
  }
}
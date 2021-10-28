import { DataSource } from '@angular/cdk/collections/data-source';
import { Injectable } from '@angular/core';
import { DatabaseReference, DataSnapshot, refFromURL } from '@firebase/database';
import { ComponentStore } from '@ngrx/component-store';
import { combineLatest, EMPTY, of } from 'rxjs';
import { catchError, concatMap, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { object } from 'rxfire/database';
import { FormControl } from '@angular/forms';

interface State {
  rootRef: DatabaseReference | undefined;
  query: string | undefined;
  collapsedRefs: Set<string>;
  childEditors: Record<string, FormControl[]>;
}

const INITIAL_STATE: State = {
  rootRef: undefined,
  query: undefined,
  collapsedRefs: new Set(),
  childEditors: {},
}

export type JsonPrimitive = string | number | boolean | null;

export type Json =
  | JsonPrimitive
  | { [property: string]: Json }
  | Json[];

export type FlatSnapshot = [DatabaseReference, JsonPrimitive];

export enum NodeType {
  REALTIME = 1,
  EDITOR,
  SAVE,
  REST,
}

interface RealtimeNode {
  type: NodeType.REALTIME;
  value: JsonPrimitive;
}

interface EditorNode {
  type: NodeType.EDITOR;
  formControl: FormControl;
}

interface SaveNode {
  type: NodeType.SAVE;
}

interface RestNode {
  type: NodeType.REST;
}

export type RtdbNode = { type: NodeType, ref: DatabaseReference, level: number, } & (RealtimeNode | EditorNode | SaveNode | RestNode);


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
  readonly childEditors$ = this.select(state => state.childEditors);

  readonly setRootRef = this.updater((state, rootRef: DatabaseReference | undefined) => ({
    ...state,
    rootRef,
    collapsedRefs: new Set(),
    childEditors: {},
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

  readonly addChildEditor = this.updater((state, ref: DatabaseReference) => {
    const refURL = ref.toString();

    return {
      ...state,
      childEditors: {
        ...state.childEditors,
        [refURL]: [...state.childEditors[refURL] ?? [], new FormControl(null),]
      },
    };
  });

  private readonly flatSnapshot$ =
    combineLatest([this.rootRef$, this.collapsedRefs$, this.childEditors$]).pipe(
      switchMap(([ref, collapsedRefs, childEditors]) => {
        if (!ref) {
          return of([]);
        }

        return object(ref).pipe(
          map(({ snapshot }) => {
            return [];
            // console.log({ ref, collapsedRefs, data: snapshot.val() });
            // const t0 = performance.now();
            // const flatSnapshot = flattenSnapshot(snapshot, collapsedRefs);
            // const t1 = performance.now();
            // console.log({ flatSnapshot, time: t1 - t0 })

            // const t0b = performance.now();
            // const snapshots = walkTree(snapshot, collapsedRefs, childEditors);
            // const x = [];
            // for (const s of snapshots) {
            //   x.push(s);
            // }
            // const t1b = performance.now();
            // console.log({ uber: x, time: t1b - t0b })

            // return flatSnapshot;
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
      return [];
      // const t0 = performance.now();
      // if (!query) {
      //   return [];
      // }

      // const indicies: number[] = [];
      // for (let i = 0; i < flatSnapshot.length; i++) {
      //   const [ref, val] = flatSnapshot[i];
      //   if (ref.toString().includes(query) || val.toString().includes(query)) {
      //     indicies.push(i);
      //   }
      // }
      // const t1 = performance.now();
      // console.log({ queryResultsCount: indicies.length, time: t1 - t0 })

      // return indicies;
    }),
  );

  readonly object$ = this.rootRef$.pipe(
    switchMap(ref => ref ? object(ref) : EMPTY),
    shareReplay({ bufferSize: 1, refCount: true }),
  )

  readonly uber$ = combineLatest([this.rootRef$, this.object$, this.collapsedRefs$, this.childEditors$,]).pipe(map(([rootRef, { snapshot }, collapsedRefs, childEditors,]) => {
    console.log({ snapshot, collapsedRefs, childEditors });

    const t0 = performance.now();
    const snapshots = walkTree({ snapshot, collapsedRefs, childEditors });
    const uber: RtdbNode[] = [];
    for (const s of snapshots) {
      uber.push(s);
    }
    const t1 = performance.now();
    console.log({ uber, time: t1 - t0 });
    return uber;
  }));

  connect() {
    return this.uber$;
  }

  disconnect() { }
}

interface WalkTree {
  snapshot: DataSnapshot;
  collapsedRefs: Set<string>;
  childEditors: Record<string, FormControl[]>;
  level?: number;
}

function* walkTree({ snapshot, collapsedRefs, childEditors, level = 0 }: WalkTree): Generator<RtdbNode, void, void> {
  const refUrl = snapshot.ref.toString();

  if (snapshot.hasChildren()) {
    yield {
      type: NodeType.REALTIME,
      ref: snapshot.ref,
      value: null,
      level,
    }

    const editors = childEditors[refUrl];
    if (editors?.length) {
      for (const editor of editors) {
        yield {
          type: NodeType.EDITOR,
          ref: snapshot.ref,
          formControl: editor,
          level: level + 1,
        };
      }

      yield {
        type: NodeType.SAVE,
        ref: snapshot.ref,
        level: level + 1,
      };
    }

    if (!collapsedRefs.has(refUrl)) {
      const children: DataSnapshot[] = [];
      snapshot.forEach(c => {
        children.push(c);
      });
      for (const child of children) {
        yield* walkTree({ snapshot: child, collapsedRefs, childEditors, level: level + 1, });
      }
    }
  } else {
    yield {
      type: NodeType.REALTIME,
      ref: snapshot.ref,
      value: snapshot.val(),
      level: level,
    }
  }
}

function flattenSnapshot(snapshot: DataSnapshot, collapsedRefs: Set<string>): FlatSnapshot[] {
  if (snapshot.hasChildren()) {
    const children: Array<FlatSnapshot[]> = [];

    if (!collapsedRefs.has(snapshot.ref.toString())) {
      snapshot.forEach(s => {
        children.push(flattenSnapshot(s, collapsedRefs));
      });
    }

    return [[snapshot.ref, null], ...children.flat()];
  } else {
    return [[snapshot.ref, snapshot.val()]];
  }
}
import { DataSource } from '@angular/cdk/collections/data-source';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatabaseReference, DataSnapshot, refFromURL } from '@firebase/database';
import { ComponentStore, tapResponse } from '@ngrx/component-store';
import { combineLatest, EMPTY, Observable, of, throwError } from 'rxjs';
import { catchError, concatMap, map, shareReplay, switchMap, switchMapTo, tap, withLatestFrom } from 'rxjs/operators';
import { object, QueryChange } from 'rxfire/database';
import { AbstractControl, FormArray, FormControl, FormGroup, NgControlStatus } from '@angular/forms';
import { assert } from '@firebase/util';
import { registerLocaleData } from '@angular/common';

interface State {
  rootRef: DatabaseReference | undefined;
  query: string | undefined;
  collapsedRefs: Set<string>;
  childEditors: Record<string, FormArray>;
  dataSnapshot: DataSnapshot | null;
  restData: { [ref: string]: Json } | null;
}

const INITIAL_STATE: State = {
  rootRef: undefined,
  query: undefined,
  collapsedRefs: new Set(),
  childEditors: {},
  dataSnapshot: null,
  restData: null,
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
  // value: JsonPrimitive;
  snapshot: DataSnapshot | null;
  isExpandable: boolean;
}

interface EditorNode {
  type: NodeType.EDITOR;
  isExpandable: false;
  keyControl: FormControl;
  valueControl?: FormControl;
  path: number[];
}

interface SaveNode {
  type: NodeType.SAVE;
  formControl: FormArray;
  isExpandable: false;
}

interface RestNode {
  type: NodeType.REST;
  value: Json;
  isExpandable: boolean;
}

export type RtdbNode = { type: NodeType, refPath: string, level: number, } & (RealtimeNode | EditorNode | SaveNode | RestNode);

let walkAbstractControlPerformance = 0;
let retToStringPerfomance = 0;
let childrenForEachPerformance = 0;
let childrenWalkTreePerformance = 0;
let snapshotValPerformance = 0;

export function relativeRefPath(ref: DatabaseReference, rootRef: DatabaseReference): string {
  return ref.toString().replace(rootRef.toString(), '/');
}


@Injectable()
export class RtdbViewerStore
  extends ComponentStore<State>
  implements DataSource<RtdbNode>
{
  constructor(private readonly httpClient: HttpClient) {
    super(INITIAL_STATE);

    this.effect(hydrate$ => this.rootRef$.pipe(
      switchMap(rootRef => {
        if (!rootRef) return EMPTY;

        return object(rootRef).pipe(
          concatMap(() => {
            return throwError(() => 'nah!');
          }),
          tapResponse(
            ({ snapshot }) => this.patchState({ dataSnapshot: snapshot }),
            () => this.fetchData({ ref: '' }),
          ));
      }),
    ));
  }

  readonly rootRef$ = this.select(state => state.rootRef);
  readonly query$ = this.select(state => state.query);
  readonly dataSnapshot$ = this.select(state => state.dataSnapshot);
  readonly restData$ = this.select(state => state.restData);
  readonly collapsedRefs$ = this.select(state => state.collapsedRefs);
  readonly childEditors$ = this.select(state => state.childEditors);

  readonly setRootRef = this.updater((state, rootRef: DatabaseReference | undefined) => ({
    ...state,
    rootRef,
    dataSnapshot: null,
    restData: null,
    collapsedRefs: new Set(),
    childEditors: {},
  }));

  readonly setQuery = this.updater((state, query: string) => ({
    ...state,
    query,
  }));

  readonly expandNode = this.updater((state, refPath: string) => {
    const collapsedRefs = new Set(state.collapsedRefs);
    collapsedRefs.delete(refPath);

    console.log('expand', { refPath });

    return {
      ...state,
      collapsedRefs,
    };
  });

  readonly collapseNode = this.updater((state, refPath: string) => {
    console.log('collapse', { refPath });

    return {
      ...state,
      collapsedRefs: new Set([...state.collapsedRefs, refPath]),
    };
  });

  readonly addChildEditor = this.updater((state, { refPath, path = [] }: { refPath: string, path?: number[] }) => {
    let editors = state.childEditors[refPath] ?? new FormArray([]);

    console.log({ editors });

    let foo: FormArray = editors;
    for (const index of path) {
      const temp = foo.at(index);
      if (isFormArray(temp)) {
        foo = temp;
      } else if (isFormGroup(temp)) {
        // ensure the value is null
        castFormControl(temp.get('value')).setValue(null);
        foo = castFormArray(temp.get('children'));
      }
    }

    foo.push(new FormGroup({
      key: new FormControl(''),
      value: new FormControl(''),
      children: new FormArray([]),
    }));

    return {
      ...state,
      childEditors: {
        ...state.childEditors,
        [refPath]: editors,
      },
    };
  });

  readonly removeChildEditor = this.updater((state, { refPath, path }: { refPath: string, path: number[] }) => {
    const editors = state.childEditors[refPath];

    if (!editors) {
      return state;
    }

    const key = path.pop();
    if (key === undefined) {
      return state;
    }

    let editor: AbstractControl = editors;
    for (const i of path) {
      if (isFormArray(editor)) {
        editor = editors.at(i);
      } else if (isFormGroup(editor)) {
        editor = castFormArray(editor.get('children')).at(i);
      }
    }

    if (isFormArray(editor)) {
      editor.removeAt(key);
    } else if (isFormGroup(editor)) {
      const children = castFormArray(editor.get('children'));
      children.removeAt(key);
      if (children.length === 0) {
        castFormControl(editor.get('value')).setValue('');
      }
    }

    return {
      ...state,
      childEditors: {
        ...state.childEditors,
        [refPath]: editors,
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
    }),
  );

  readonly object$ = this.rootRef$.pipe(
    switchMap(ref => ref ? object(ref) : EMPTY),
    shareReplay({ bufferSize: 1, refCount: true }),
  )

  readonly object2$ = this.select(this.rootRef$.pipe(
    switchMap(ref => ref ? object(ref) : EMPTY),
    // tap(() => this.fetchData({ref: ''})),
  ), dataSnapshot => dataSnapshot);

  readonly uber$: Observable<RtdbNode[]> = this.select(this.rootRef$, this.dataSnapshot$, this.collapsedRefs$, this.childEditors$, this.restData$, (rootRef, snapshot, collapsedRefs, childEditors, restData) => {
    if (!snapshot && !restData) {
      return [];
    }

    if (snapshot) {
      console.log({ snapshot, collapsedRefs, childEditors });
      (window as any).snapshot = snapshot;

      const t0 = performance.now();
      // const uber = [...walkTree({ snapshot, collapsedRefs, childEditors })];
      const uber = walkTreeRecurseMutate({ snapshot, collapsedRefs, childEditors });
      const t1 = performance.now();
      console.log({ uber, time: t1 - t0 });
      return uber;
    } else {
      console.log({ restData });
      const t0 = performance.now();
      const uber = walkRestTreeRecurseMutate({ restData: restData!['']!, allRestData: restData ?? {}, collapsedRefs });
      const t1 = performance.now();
      console.log({ uber, time: t1 - t0 });
      return uber;
    }
  });

  connect() {
    return this.uber$;
  }

  disconnect() { }

  readonly fetchData = this.effect<{ ref: string }>(fetch$ => fetch$.pipe(
    withLatestFrom(this.rootRef$),
    concatMap(([{ ref }, rootRef]) => {
      if (!rootRef) return EMPTY;

      // TODO: urlencode the ref + handle root-ref case
      return this.httpClient.get<Json>(`${rootRef.toString()}/${ref}.json?shallow=true&r=f`).pipe(
        tapResponse(
          (data) => this.patchState(state => ({ ...state, restData: { ...state.restData, [ref]: data }, })),
          (error) => { },
        ),
      );
    }),
  ));
}

interface WalkRestTree {
  restData: Json,
  allRestData: Json,
  collapsedRefs: Set<string>;
  level?: number;
}

function walkRestTreeRecurseMutate({ restData, allRestData, collapsedRefs, level = 0 }: WalkRestTree): RtdbNode[] {
  const nodes: RtdbNode[] = [];

  function foo({ restData, level, refPath }: { restData: Json, level: number, refPath: string }) {
    console.log({ restData, allRestData, refPath });
    if (restData instanceof Object) {
      nodes.push({
        type: NodeType.REST,
        value: null,
        isExpandable: true,
        refPath,
        level,
      });

      if (!collapsedRefs.has(refPath)) {
        for (const [key, value] of Object.entries(restData)) {
          foo({ restData: allRestData![`${refPath}/${key}`] ?? value, level: level + 1, refPath: `${refPath}/${key}` });
        }
      }
    }
    else {
      nodes.push({
        type: NodeType.REST,
        value: allRestData![refPath] ?? restData,
        isExpandable: restData === true && !allRestData![refPath],
        refPath,
        level,
      });
    }
  }

  foo({ restData, level, refPath: '' });
  return nodes;
}

function walkTreeRecurseMutate({ snapshot, collapsedRefs, childEditors, level = 0 }: WalkTree): RtdbNode[] {
  // (console as any).profile('walkTree');
  const nodes: RtdbNode[] = [];

  function foo({ snapshot, level, refPath }: { snapshot: DataSnapshot, level: number, refPath: string }) {
    if (snapshot.hasChildren()) {
      nodes.push({
        type: NodeType.REALTIME,
        refPath,
        snapshot: null,
        level,
        isExpandable: true,
      });

      const editor = childEditors[refPath];
      if (editor?.length) {
        for (const e of walkAbstractControl({ control: editor, level })) {
          nodes.push({
            ...e,
            refPath,
            level: level + e.path.length,
          });
        }

        nodes.push({
          type: NodeType.SAVE,
          refPath,
          level: level + 1,
          isExpandable: false,
          formControl: editor,
        });
      }

      if (!collapsedRefs.has(refPath)) {
        snapshot.forEach(childSnapshot => {
          foo({ snapshot: childSnapshot, level: level + 1, refPath: `${refPath}/${childSnapshot.key}` });
        });
      }
    } else {
      nodes.push({
        type: NodeType.REALTIME,
        refPath,
        snapshot: snapshot,
        level,
        isExpandable: false,
      });
    }
  }

  foo({ snapshot, level, refPath: snapshot.key ?? '/' });
  // (console as any).profileEnd('walkTree');
  return nodes;
}

interface WalkTree {
  snapshot: DataSnapshot;
  collapsedRefs: Set<string>;
  childEditors: Record<string, FormArray>;
  level?: number;
}

// function* walkTree({ snapshot, collapsedRefs, childEditors, level = 0 }: WalkTree): Generator<RtdbNode, void, void> {
// 
//   if (snapshot.hasChildren()) {
//     yield {
//       type: NodeType.REALTIME,
//       ref: snapshot.ref,
//       // value: null,
//       snapshot: null,
//       level,
//       isExpandable: true,
//     }
// 
//     const refUrl = snapshot.ref.toString();
// 
//     const editors = childEditors[refUrl];
//     if (editors?.length) {
//       for (const editor of walkAbstractControl({ control: editors, level })) {
//         yield {
//           ...editor,
//           ref: snapshot.ref,
//           level: level + editor.path.length,
//         };
//       }
// 
//       yield {
//         type: NodeType.SAVE,
//         ref: snapshot.ref,
//         level: level + 1,
//         isExpandable: false,
//         formControl: editors,
//       };
//     }
// 
//     if (!collapsedRefs.has(refUrl)) {
//       const children: DataSnapshot[] = [];
//       snapshot.forEach(c => {
//         children.push(c);
//       });
//       for (const child of children) {
//         yield* walkTree({ snapshot: child, collapsedRefs, childEditors, level: level + 1, });
//       }
//     }
//   } else {
//     yield {
//       type: NodeType.REALTIME,
//       ref: snapshot.ref,
//       snapshot,
//       // value: snapshot.val(),
//       level: level,
//       isExpandable: false,
//     }
//   }
// }

interface WalkAbstractControl {
  control: AbstractControl;
  path?: number[];
  level?: number;
}

// Check if FormGroup<{key: FormControl, value: FormControl, children: FormArray}>
function isEditorContols(control: AbstractControl): control is any {
  return true;
}

function isChildEditor(controls?: AbstractControl[]): controls is [FormControl, FormArray] {
  return controls?.length === 2 && isFormControl(controls[0]) && isFormArray(controls[1]);
}

function isLeafEditor(controls?: AbstractControl[]): controls is FormControl[] {
  return !!controls?.every(c => isFormControl(c));
}


function isFormArray(control?: AbstractControl | null): control is FormArray {
  return !!control && control.hasOwnProperty('controls') && Array.isArray(control.value);
}

function isFormGroup(control?: AbstractControl): control is FormGroup {
  return !!control && control.hasOwnProperty('controls') && !Array.isArray(control.value);
}

function assertFormArray(control?: AbstractControl | null): asserts control is FormArray {
  if (!isFormArray(control)) {
    throw new Error('control is not a FormArray');
  }
}

function castFormArray(control?: AbstractControl | null): FormArray {
  assertFormArray(control);
  return control;
}

function isFormControl(control?: AbstractControl | null): control is FormControl {
  return !!control && !control.hasOwnProperty('controls');
}

function assertFormControl(control?: AbstractControl | null): asserts control is FormControl {
  if (!isFormControl(control)) {
    throw new Error('control is not a FormControl');
  }
}

function castFormControl(control?: AbstractControl | null): FormControl {
  assertFormControl(control);
  return control;
}

function assertKeyValueControlsTwo(controls: AbstractControl[]): asserts controls is [FormControl, FormArray] {
  if (controls.length !== 2) {
    throw new Error('length not two');
  }
  if (!isFormControl(controls[0])) {
    throw new Error('key control is not a form-control');
  }
  if (!isFormArray(controls[1])) {
    throw new Error('value control is not a form-array');
  }
}

function isKeyValueControls(controls: AbstractControl[]): controls is [FormControl, FormArray] | [FormControl, FormArray] {
  return (controls.length === 2 && isFormControl(controls[0]) && (isFormControl(controls[1]) || isFormArray(controls[1])));
}

function assertKeyValueControls(controls: AbstractControl[]): asserts controls is [FormControl, FormArray] {
  if (controls.length !== 2) {
    throw new Error('nah');
  }
  if (!isFormControl(controls[0])) {
    throw new Error('key control is not a formcontrol');
  }
  if (!isFormControl(controls[1]) && !isFormArray(controls[1])) {
    throw new Error('value control is not a form control or form array');
  }
}

/**
 * Controls:
 * 
 * Array<Key, Values> where:
 *    Key: can be null (root node) or a FormControl<string>
 *    Values: FormArray of either: <Key, Values> OR <FormControl>
 * 
 * 
 */
function* walkAbstractControl({ control, path = [], level = 0 }: WalkAbstractControl): Generator<EditorNode, void, void> {
  if (isFormArray(control)) {
    for (const [index, childControl] of control.controls.entries()) {
      yield* walkAbstractControl({ control: childControl, path: [...path, index], level: level + 1 });
    }
  } else if (isFormGroup(control)) {
    const keyControl = castFormControl(control.get('key'));
    const valueControl = castFormControl(control.get('value'));
    const childrenControl = castFormArray(control.get('children'));

    if (valueControl.value === null) {
      yield {
        type: NodeType.EDITOR,
        keyControl,
        isExpandable: false,
        path,
      };

      yield* walkAbstractControl({ control: childrenControl, path });
    } else {
      yield {
        type: NodeType.EDITOR,
        keyControl,
        valueControl,
        isExpandable: false,
        path,
      };

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
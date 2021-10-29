import { DataSource } from '@angular/cdk/collections/data-source';
import { Injectable } from '@angular/core';
import { DatabaseReference, DataSnapshot, refFromURL } from '@firebase/database';
import { ComponentStore } from '@ngrx/component-store';
import { combineLatest, EMPTY, of } from 'rxjs';
import { catchError, concatMap, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { object } from 'rxfire/database';
import { AbstractControl, FormArray, FormControl, FormGroup, NgControlStatus } from '@angular/forms';
import { assert } from '@firebase/util';

interface State {
  rootRef: DatabaseReference | undefined;
  query: string | undefined;
  collapsedRefs: Set<string>;
  childEditors: Record<string, FormArray>;
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
  isExpandable: boolean;
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

  readonly addChildEditor = this.updater((state, { ref, path = [] }: { ref: DatabaseReference, path?: number[] }) => {
    const refURL = ref.toString();
    let editors = state.childEditors[refURL] ?? new FormArray([]);

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
        [refURL]: editors,
      },
    };
  });

  readonly removeChildEditor = this.updater((state, { ref, path }: { ref: DatabaseReference, path: number[] }) => {
    const refURL = ref.toString();
    const editors = state.childEditors[refURL];

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
        [refURL]: editors,
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
  childEditors: Record<string, FormArray>;
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
      isExpandable: true,
    }

    const editors = childEditors[refUrl];
    if (editors?.length) {
      for (const editor of walkAbstractControl({ control: editors, level })) {
        yield {
          ...editor,
          ref: snapshot.ref,
          level: level + editor.path.length,
        };
      }

      yield {
        type: NodeType.SAVE,
        ref: snapshot.ref,
        level: level + 1,
        isExpandable: false,
        formControl: editors,
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
      isExpandable: false,
    }
  }
}

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
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { AbstractControl, FormArray, FormControl } from "@angular/forms";
import { DatabaseReference, DataSnapshot } from "@firebase/database";
import { BehaviorSubject, combineLatest, ReplaySubject } from "rxjs";
import { map } from 'rxjs/operators';
import { Json, JsonPrimitive, RtdbViewerStore } from "./rtdb-viewer.store";

@Component({
    selector: 'rtdb-realtime-node',
    template: `
        <ng-container *ngIf="isExpandable">
            <button *ngIf="isExpanded$ | async; else collapsed" (click)="collapse()">-</button>
            <ng-template #collapsed>
                <button (click)="expand()">+</button>
            </ng-template>
        </ng-container>
        <span>{{ refPath$.value || '_root_' }}</span>
        &nbsp;
        <ng-container *ngIf="value$ | async as value; else addChild">
            <span>{{ value.val }}</span>
        </ng-container>
        <ng-template #addChild>
            <button *ngIf="refPath" (click)="store.addChildEditor({refPath})">Add child</button>
        </ng-template>
    `,
    styles: [`
        :host {
            display: flex;
        } 
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbRealtimeNodeComponent {
    @Input()
    set refPath(refPath: string) {
        this.refPath$.next(refPath);
    }
    readonly refPath$ = new BehaviorSubject('');

    @Input() isExpandable = false;

    @Input()
    set snapshot(snapshot: DataSnapshot | null) {
        if (snapshot?.exists()) {
            this.value$.next({ val: snapshot.val() });
        } else {
            this.value$.next(null);
        }
    }
    readonly value$ = new ReplaySubject<{ val: JsonPrimitive } | null>(1);

    readonly isExpanded$ = combineLatest([this.store.collapsedRefs$, this.refPath$]).pipe(
        map(([collapsedRefs, refPath]) => {
            console.log({collapsedRefs, refPath});

            return !collapsedRefs.has(refPath);
        }),
    );

    constructor(readonly store: RtdbViewerStore) { }

    expand() {
        console.log('expand!');
        this.store.expandNode(this.refPath$.value);
    }

    collapse() {
        console.log('collapse!');
        this.store.collapseNode(this.refPath$.value);
    }
}

@Component({
    selector: 'rtdb-editor-node',
    template: `
        <span>p:{{ path }}</span>
        <span>--</span>
        <span>r:{{ refPath }}</span>
        <input *ngIf="keyControl" [formControl]="keyControl" placeholder="key" />
        <input *ngIf="valueControl" [formControl]="valueControl" placeholder="value" />
        <button (click)="remove()">x</button>
        <button *ngIf="!valueControl || valueControl.value === ''" (click)="addChild()">+</button>
    `,
    styles: [`
        :host {
            display: block;
        } 
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbEditorNodeComponent {
    @Input() refPath?: string;
    @Input() keyControl?: FormControl;
    @Input() valueControl?: FormControl;
    @Input() path?: number[];

    remove() {
        if (this.refPath && this.path) {
            this.store.removeChildEditor({ refPath: this.refPath, path: this.path });
        }
    }

    addChild() {
        if (this.refPath && this.path) {
            this.store.addChildEditor({ refPath: this.refPath, path: this.path });
        }
    }

    constructor(readonly store: RtdbViewerStore) { }
}

@Component({
    selector: 'rtdb-save-node',
    template: `
        <button *ngIf="control" [disabled]="control.invalid">Save</button>
    `,
    styles: [`
        :host {
            display: block;
        } 
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbSaveNodeComponent {
    @Input() refPath?: string;
    @Input() control?: FormArray;

    constructor(readonly store: RtdbViewerStore) { }
}

@Component({
    selector: 'rtdb-rest-node',
    template: `
        <ng-container *ngIf="isExpandable">
            <button *ngIf="isExpanded$ | async; else collapsed" (click)="collapse()">-</button>
            <ng-template #collapsed>
                <button (click)="expand()">+</button>
        </ng-template>
        </ng-container>
        <span>{{ (refPath$ | async) || '_root_' }}</span>
        &nbsp;
        <span>{{ value }}</span>
    `,
    styles: [`
        :host {
            display: block;
        } 
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbRestNodeComponent {
    @Input() value?: Json;
    @Input()
    set refPath(refPath: string) {
        this.refPath$.next(refPath);
    }
    readonly refPath$ = new BehaviorSubject('');

    @Input() isExpandable = false;

    readonly isExpanded$ = combineLatest([this.store.restData$, this.refPath$]).pipe(
        map(([restData, refPath]) => {
            return restData![refPath];
        }),
    );

    constructor(readonly store: RtdbViewerStore) { }

    expand() {
        console.log('expand!');
        this.store.expandNode(this.refPath$.value);
        this.store.fetchData({ref: this.refPath$.value});
    }

    collapse() {
        console.log('collapse!');
        this.store.collapseNode(this.refPath$.value);
    }
}
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { AbstractControl, FormArray, FormControl } from "@angular/forms";
import { DatabaseReference, DataSnapshot } from "@firebase/database";
import { ReplaySubject } from "rxjs";
import { JsonPrimitive, RtdbViewerStore } from "./rtdb-viewer.store";

@Component({
    selector: 'rtdb-realtime-node',
    template: `
        <span>{{ refPath || '_root_' }}</span>
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
            display: block;
        } 
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbRealtimeNodeComponent {
    @Input() refPath?: string;
    @Input()
    set snapshot(snapshot: DataSnapshot|null) {
        if (snapshot?.exists() ) {
            this.value$.next({val: snapshot.val()});
        } else {
            this.value$.next(null);
        }
    }
    readonly value$ = new ReplaySubject<{val: JsonPrimitive}|null>(1);


    constructor(readonly store: RtdbViewerStore) { }
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
            this.store.removeChildEditor({refPath: this.refPath, path: this.path});
        }
    }

    addChild() {
        if (this.refPath && this.path) {
            this.store.addChildEditor({refPath: this.refPath, path: this.path});
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
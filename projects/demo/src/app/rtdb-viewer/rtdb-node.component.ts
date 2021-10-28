import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { AbstractControl, FormArray, FormControl } from "@angular/forms";
import { DatabaseReference } from "@firebase/database";
import { JsonPrimitive, RtdbViewerStore } from "./rtdb-viewer.store";

@Component({
    selector: 'rtdb-realtime-node',
    template: `
        <span>{{ ref?.toString() }} {{ value }}</span>
        <button *ngIf="ref && value === null" (click)="store.addChildEditor(ref)">Add child</button>`,
    styles: [`
        :host {
            display: block;
        } 
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbRealtimeNodeComponent {
    @Input() ref?: DatabaseReference;
    @Input() value?: JsonPrimitive;

    constructor(readonly store: RtdbViewerStore) { }
}

@Component({
    selector: 'rtdb-editor-node',
    template: `
        <span>{{ ref?.toString() }} <input *ngIf="control" [formControl]="control"></span><button (click)="remove()">x</button>
    `,
    styles: [`
        :host {
            display: block;
        } 
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbEditorNodeComponent {
    @Input() ref?: DatabaseReference;
    @Input() control?: FormControl;

    // TODO: this doesn't work; as crazy as it sounds, we need to walk the whole tree again on deletion, which means triggering store changes
    remove() {
        if (this.ref && this.control && this.control.parent) {
            // (this.control.parent as FormArray).removeAt(0);
            this.store.removeChildEditor({ref: this.ref, control: this.control});
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
    @Input() ref?: DatabaseReference;
    @Input() control?: FormArray;

    constructor(readonly store: RtdbViewerStore) { }
}
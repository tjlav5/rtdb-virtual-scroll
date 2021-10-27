import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { DatabaseReference } from "@firebase/database";
import { JsonPrimitive } from "./rtdb-viewer.store";

@Component({
    selector: 'rtdb-realtime-node',
    template: '{{ ref?.toString() }} {{ value }}',
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
}
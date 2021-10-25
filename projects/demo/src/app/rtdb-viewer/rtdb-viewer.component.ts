import { animateChild, query, transition, trigger } from '@angular/animations';
import { CdkVirtualForOf } from '@angular/cdk/scrolling';
import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  Input,
} from '@angular/core';
import { throttleTime, debounceTime, tap } from 'rxjs/operators';
import { FlatSnapshot, RtdbViewerStore } from './rtdb-viewer.store';
import { DatabaseReference } from '@firebase/database';

@Component({
  selector: 'rtdb-viewer',
  template: `
    <cdk-virtual-scroll-viewport itemSize="50">
      <div
        *cdkVirtualFor="let item of store; trackBy: trackByFlatSnapshot; templateCacheSize: 0"
        [@.disabled]="isScrolling"
        [@rtdbAddRemove]
      >
        <div style="height: 50px">{{ item | json }}</div>
      </div>
  `,
  animations: [
    trigger('rtdbAddRemove', [
      // transition(':enter', [query('@*', animateChild())]),
      // transition(':leave', [query('@*', animateChild())]),
    ]),
  ],
  styles: [
    `
      :host {
        display: block;
      }

      cdk-virtual-scroll-viewport {
        height: 100%;
      }
    `,
  ],
  providers: [RtdbViewerStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbViewerComponent {
  isScrolling = false;

  @Input()
  set ref(ref: DatabaseReference|undefined) {
    this.store.setRootRef(ref);
  }

  @ViewChild(CdkVirtualForOf, { static: true })
  private readonly virtualForOf?: CdkVirtualForOf<{}>;

  constructor(
    readonly store: RtdbViewerStore,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.virtualForOf.viewChange
      .pipe(
        throttleTime(10),
        tap(() => {
          this.isScrolling = true;
          this.cdr.markForCheck();
        }),
        debounceTime(100)
      )
      .subscribe(() => {
        this.isScrolling = false;
        this.cdr.markForCheck();
      });
  }

  trackByFlatSnapshot(index: number, flatSnapshot: FlatSnapshot) {
    return flatSnapshot[0].toString();
  }
}

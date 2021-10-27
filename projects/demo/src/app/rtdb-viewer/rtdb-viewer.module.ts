import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RtdbViewerComponent } from './rtdb-viewer.component';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ReactiveFormsModule } from '@angular/forms';
import { RtdbRealtimeNodeComponent } from './rtdb-node.component';

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, ScrollingModule],
  declarations: [RtdbRealtimeNodeComponent, RtdbViewerComponent],
  exports: [RtdbViewerComponent],
})
export class RtdbViewerModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RtdbViewerComponent } from './rtdb-viewer.component';
import { ScrollingModule } from '@angular/cdk/scrolling';

@NgModule({
  imports: [CommonModule, ScrollingModule],
  declarations: [RtdbViewerComponent],
  exports: [RtdbViewerComponent],
})
export class RtdbViewerModule {}

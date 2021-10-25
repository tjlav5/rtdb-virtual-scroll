import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RtdbViewerComponent } from './rtdb-viewer.component';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, ScrollingModule],
  declarations: [RtdbViewerComponent],
  exports: [RtdbViewerComponent],
})
export class RtdbViewerModule {}

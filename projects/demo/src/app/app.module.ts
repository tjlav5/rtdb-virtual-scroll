import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { RtdbViewerModule } from './rtdb-viewer/rtdb-viewer.module';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserAnimationsModule,
    RtdbViewerModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

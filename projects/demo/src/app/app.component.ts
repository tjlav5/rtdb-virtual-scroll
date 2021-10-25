import { Component } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {  DatabaseReference, getDatabase, ref } from 'firebase/database';

@Component({
  selector: 'app-root',
  template: '<rtdb-viewer [ref]="ref"></rtdb-viewer>',
  styles: [
    `
      rtdb-viewer {
        height: 600px;
      }
    `,
  ],
})
export class AppComponent {
  readonly ref: DatabaseReference;

  constructor() {
    const firebaseConfig = {
      apiKey: 'AIzaSyCiW1IwZwNT0uIRN0YoS4-IxUmWSOLeFis',
      databaseURL: 'https://tlavelle-dev-default-rtdb.firebaseio.com',
      projectId: 'tlavelle-dev',
      appId: '1:514118514692:web:0516225dedb626d95b1d51',
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    this.ref = ref(db);
  }
}

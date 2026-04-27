import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const appRoutes: Routes = [
  {
    path: '',
    component: DashboardComponent,
  },
  {
    path: 'settings',
    component: SettingsComponent,
  },
];
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { TrumpNewsItem } from '../models';

/**
 * Accès à la veille « Trump TV / news / conférences de presse ».
 * Les erreurs réseau sont absorbées (liste vide) pour ne jamais bloquer
 * la section Trump Watch.
 */
@Injectable({ providedIn: 'root' })
export class TrumpNewsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getTrumpNews(limit = 8): Observable<TrumpNewsItem[]> {
    return this.http.get<TrumpNewsItem[]>(`${this.apiUrl}/trump/news?limit=${limit}`).pipe(
      catchError(() => of([] as TrumpNewsItem[]))
    );
  }
}

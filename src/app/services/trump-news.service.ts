import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TrumpNewsItem } from '../models';

/**
 * Accès à la veille « Trump TV / news / conférences de presse ».
 * Les erreurs réseau sont absorbées (liste vide) pour ne jamais bloquer
 * la section Trump Watch.
 */
@Injectable({ providedIn: 'root' })
export class TrumpNewsService {
  private baseUrl = 'http://localhost:3001/api';

  constructor(private http: HttpClient) {}

  getTrumpNews(limit: number = 8): Observable<TrumpNewsItem[]> {
    return this.http.get<TrumpNewsItem[]>(`${this.baseUrl}/trump/news?limit=${limit}`).pipe(
      catchError(() => of([] as TrumpNewsItem[]))
    );
  }
}

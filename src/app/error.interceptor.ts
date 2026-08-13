import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * Intercepteur HTTP global : journalise les erreurs réseau/API et les
 * relance telles quelles (l'original conserve status/body). Les composants
 * gardent leur propre gestion d'erreur (toast, fallback, retry).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err) => {
      console.error(
        `[HTTP] ${req.method} ${req.url}`,
        err?.status ?? '',
        err?.message ?? err,
      );
      return throwError(() => err);
    }),
  );

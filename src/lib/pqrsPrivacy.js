// Reserva de identidad del reportante en PQRS (DRT RF-PQR-4, Ley 1581/2012).
// Única fuente de verdad para el enmascaramiento: la usan tanto la pantalla
// de PQRS como las exportaciones (CSV/JSON), para que ningún camino alterno
// filtre lo que el otro oculta.
export function maskFeedback(feedback, canSeeIdentity) {
  if (canSeeIdentity || !feedback.is_confidential) return feedback;
  return { ...feedback, contact_info: '[RESERVADO]' };
}

import React from 'react';

export default function RemovalRequest({
  lang,
  vin,
}: {
  lang?: string;
  vin?: string;
}) {
  const isRu = (lang || 'en').toLowerCase() === 'ru';
  const V = (vin || '').toUpperCase();
  return (
    <section id="removal-request" className="card p-4 mt-8">
      <h3 className="card-title mb-2">
        {isRu ? 'Removal request (удаление)' : 'Removal request'}
      </h3>
      <p className="text-sm text-fg-muted">
        {isRu ? (
          <>
            Напишите на{' '}
            <a href="mailto:request@vinops.online">request@vinops.online</a> или в
            Telegram{' '}
            <a href="https://t.me/keustis" target="_blank" rel="noreferrer">
              @keustis
            </a>. Укажите VIN {V || '—'} и причину.
          </>
        ) : (
          <>
            Email <a href="mailto:request@vinops.online">request@vinops.online</a> or
            Telegram{' '}
            <a href="https://t.me/keustis" target="_blank" rel="noreferrer">
              @keustis
            </a>. Include VIN {V || '—'} and reason.
          </>
        )}
      </p>
      <ul className="text-sm list-disc pl-5 mt-2">
        <li>{isRu ? 'Прикрепите подтверждение владения (при наличии).' : 'Attach proof of ownership if applicable.'}</li>
        <li>{isRu ? 'Мы скрываем VIN и фото полностью.' : 'We hide VIN and photos entirely.'}</li>
      </ul>
      <p className="text-xs text-fg-muted mt-2">
        {isRu ? 'SLA: 410 + очистка CDN ≤ 10 минут.' : 'SLA: 410 + CDN purge ≤ 10 minutes.'}
      </p>
    </section>
  );
}

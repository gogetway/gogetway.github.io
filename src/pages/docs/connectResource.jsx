import React from 'react';
import { t } from '../../utils/locale';

const ConnectResource = () => {
  return (
    <div className="connect-resource-page">
      <h1>{t('app.docs.connect.title')}</h1>
      <p>{t('app.docs.connect.description')}</p>
      
      <section className="resource-section">
        <h2>{t('app.docs.connect.section.database')}</h2>
        <p>Database connection instructions...</p>
      </section>
      
      <section className="resource-section">
        <h2>{t('app.docs.connect.section.api')}</h2>
        <p>External API integration guide...</p>
      </section>
      
      <section className="resource-section">
        <h2>{t('app.docs.connect.section.storage')}</h2>
        <p>Storage resources configuration...</p>
      </section>
    </div>
  );
};

export default ConnectResource;
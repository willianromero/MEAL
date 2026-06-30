import React, { useEffect, useState } from 'react';
import { calculateRecordHash } from '../db';
import { Shield, ShieldAlert, Check } from 'lucide-react';

export default function SignatureVerifier({ record }) {
  const [status, setStatus] = useState('verifying'); // 'verifying', 'valid', 'invalid'

  useEffect(() => {
    let active = true;
    async function verify() {
      if (!record) return;
      try {
        const hash = await calculateRecordHash(record);
        if (active) {
          if (hash === record.signature) {
            setStatus('valid');
          } else {
            setStatus('invalid');
          }
        }
      } catch (err) {
        if (active) setStatus('invalid');
      }
    }
    verify();
    return () => { active = false; };
  }, [record]);

  if (status === 'verifying') {
    return <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>Verificando firma...</span>;
  }
  
  if (status === 'valid') {
    return (
      <span 
        className="badge" 
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.2rem', 
          fontSize: '0.65rem', 
          background: 'rgba(16, 185, 129, 0.1)', 
          color: '#a7f3d0', 
          border: '1px solid rgba(16, 185, 129, 0.2)' 
        }}
      >
        <Check size={10} /> Cripto: Íntegro
      </span>
    );
  }

  return (
    <span 
      className="badge" 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '0.2rem', 
        fontSize: '0.65rem', 
        background: 'rgba(239, 68, 68, 0.15)', 
        color: '#fca5a5', 
        border: '1px solid rgba(239, 68, 68, 0.25)' 
      }}
    >
      <ShieldAlert size={10} /> ¡FIRMA INVÁLIDA / ALTERADO!
    </span>
  );
}

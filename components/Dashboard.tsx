


import React from 'react';
// FIX: Import types from the corrected types.ts file.
import { ViewState } from '../types';


export const Dashboard: React.FC<{setView: (view: ViewState) => void}> = ({ setView }) => {
 
  return (
    <div>
      Dashboard - Em breve
    </div>
  );
};
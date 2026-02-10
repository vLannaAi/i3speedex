/**
 * Types for FatturaPA (Italian Electronic Invoice) XML generation
 * Based on FatturaPA v1.2.2 specification
 */

export interface Address {
  indirizzo: string;          // Street address
  numeroCivico?: string;       // Street number
  cap: string;                 // ZIP/Postal code
  comune: string;              // City/Municipality
  provincia?: string;          // Province (2-letter code: MI, RM, etc.)
  nazione: string;             // Country (ISO 3166-1 alpha-2: IT, FR, etc.)
}

export interface IdFiscaleIVA {
  idPaese: string;             // Country code (IT, etc.)
  idCodice: string;            // VAT number (without country prefix)
}

export interface DatiAnagrafici {
  idFiscaleIVA?: IdFiscaleIVA;
  codiceFiscale?: string;
  anagrafica: {
    denominazione?: string;    // Company name
    nome?: string;             // First name (for individuals)
    cognome?: string;          // Last name (for individuals)
    titolo?: string;           // Title (Sig., Dott., etc.)
  };
  alboProfessionale?: string;
  provinciaAlbo?: string;
  numeroIscrizioneAlbo?: string;
  dataIscrizioneAlbo?: string; // YYYY-MM-DD
  regimeFiscale?: string;      // RF01-RF19
}

export interface Sede {
  indirizzo: string;
  numeroCivico?: string;
  cap: string;
  comune: string;
  provincia?: string;
  nazione: string;
}

export interface CedentePrestatore {
  datiAnagrafici: DatiAnagrafici;
  sede: Sede;
  stabile0rganizzazione?: Sede;
  iscrizioneREA?: {
    ufficio: string;           // Province code
    numeroREA: string;
    capitaleSociale?: string;  // Format: 0.00
    socioUnico?: 'SU' | 'SM';  // Single shareholder / Multiple shareholders
    statoLiquidazione: 'LS' | 'LN'; // In liquidation / Not in liquidation
  };
  contatti?: {
    telefono?: string;
    fax?: string;
    email?: string;
  };
  riferimentoAmministrazione?: string;
}

export interface CessionarioCommittente {
  datiAnagrafici: DatiAnagrafici;
  sede: Sede;
  stabileOrganizzazione?: Sede;
  rappresentanteFiscale?: {
    idFiscaleIVA: IdFiscaleIVA;
    denominazione: string;
  };
}

export interface DatiGeneraliDocumento {
  tipoDocumento: 'TD01' | 'TD02' | 'TD03' | 'TD04' | 'TD05' | 'TD06' | 'TD16' | 'TD17' | 'TD18' | 'TD19' | 'TD20' | 'TD21' | 'TD22' | 'TD23' | 'TD24' | 'TD25' | 'TD26' | 'TD27' | 'TD28';
  divisa: string;              // Currency code (EUR, USD, etc.)
  data: string;                // Invoice date YYYY-MM-DD
  numero: string;              // Invoice number
  datiRitenuta?: {
    tipoRitenuta: 'RT01' | 'RT02';
    importoRitenuta: string;   // Format: 0.00
    aliquotaRitenuta: string;  // Format: 0.00
    causalePagamento: string;  // A-Z3
  };
  datiBollo?: {
    bolloVirtuale: 'SI';
    importoBollo: string;      // Format: 0.00
  };
  datiCassaPrevidenziale?: Array<{
    tipoCassa: 'TC01' | 'TC02' | 'TC03' | 'TC04' | 'TC05' | 'TC06' | 'TC07' | 'TC08' | 'TC09' | 'TC10' | 'TC11' | 'TC12' | 'TC13' | 'TC14' | 'TC15' | 'TC16' | 'TC17' | 'TC18' | 'TC19' | 'TC20' | 'TC21' | 'TC22';
    alCassa: string;           // Format: 0.00
    importoContributoCassa: string; // Format: 0.00
    imponibileCassa?: string;  // Format: 0.00
    aliquotaIVA: string;       // Format: 0.00
    ritenuta?: 'SI';
    natura?: 'N1' | 'N2.1' | 'N2.2' | 'N3.1' | 'N3.2' | 'N3.3' | 'N3.4' | 'N3.5' | 'N3.6' | 'N4' | 'N5' | 'N6.1' | 'N6.2' | 'N6.3' | 'N6.4' | 'N6.5' | 'N6.6' | 'N6.7' | 'N6.8' | 'N6.9' | 'N7';
    riferimentoAmministrazione?: string;
  }>;
  scontoMaggiorazione?: Array<{
    tipo: 'SC' | 'MG';         // Sconto (discount) / Maggiorazione (surcharge)
    percentuale?: string;      // Format: 0.00
    importo?: string;          // Format: 0.00
  }>;
  importoTotaleDocumento?: string; // Format: 0.00
  arrotondamento?: string;    // Format: 0.00
  causale?: string[];         // Max 200 chars per element
  art73?: 'SI';
}

export interface DettaglioLinee {
  numeroLinea: number;
  tipoCessionePrestazione?: 'SC' | 'PR' | 'AB' | 'AC';
  codiceArticolo?: Array<{
    codiceTipo: string;
    codiceValore: string;
  }>;
  descrizione: string;         // Max 1000 chars
  quantita?: string;           // Format: 0.00000000
  unitaMisura?: string;        // Max 10 chars
  dataInizioPeriodo?: string;  // YYYY-MM-DD
  dataFinePeriodo?: string;    // YYYY-MM-DD
  prezzoUnitario: string;      // Format: 0.00000000
  scontoMaggiorazione?: Array<{
    tipo: 'SC' | 'MG';
    percentuale?: string;
    importo?: string;
  }>;
  prezzoTotale: string;        // Format: 0.00
  aliquotaIVA: string;         // Format: 0.00
  ritenuta?: 'SI';
  natura?: 'N1' | 'N2.1' | 'N2.2' | 'N3.1' | 'N3.2' | 'N3.3' | 'N3.4' | 'N3.5' | 'N3.6' | 'N4' | 'N5' | 'N6.1' | 'N6.2' | 'N6.3' | 'N6.4' | 'N6.5' | 'N6.6' | 'N6.7' | 'N6.8' | 'N6.9' | 'N7';
  riferimentoAmministrazione?: string;
  altriDatiGestionali?: Array<{
    tipoDato: string;
    riferimentoTesto?: string;
    riferimentoNumero?: string;
    riferimentoData?: string;  // YYYY-MM-DD
  }>;
}

export interface DatiRiepilogo {
  aliquotaIVA: string;         // Format: 0.00
  natura?: 'N1' | 'N2.1' | 'N2.2' | 'N3.1' | 'N3.2' | 'N3.3' | 'N3.4' | 'N3.5' | 'N3.6' | 'N4' | 'N5' | 'N6.1' | 'N6.2' | 'N6.3' | 'N6.4' | 'N6.5' | 'N6.6' | 'N6.7' | 'N6.8' | 'N6.9' | 'N7';
  speseAccessorie?: string;    // Format: 0.00
  arrotondamento?: string;     // Format: 0.00
  imponibileImporto: string;   // Format: 0.00
  imposta: string;             // Format: 0.00
  esigibilitaIVA?: 'I' | 'D' | 'S'; // Immediate / Deferred / Split payment
  riferimentoNormativo?: string; // Max 100 chars
}

export interface DatiBeniServizi {
  dettaglioLinee: DettaglioLinee[];
  datiRiepilogo: DatiRiepilogo[];
}

export interface DettaglioPagamento {
  beneficiario?: string;
  modalitaPagamento: 'MP01' | 'MP02' | 'MP03' | 'MP04' | 'MP05' | 'MP06' | 'MP07' | 'MP08' | 'MP09' | 'MP10' | 'MP11' | 'MP12' | 'MP13' | 'MP14' | 'MP15' | 'MP16' | 'MP17' | 'MP18' | 'MP19' | 'MP20' | 'MP21' | 'MP22' | 'MP23';
  dataRiferimentoTerminiPagamento?: string; // YYYY-MM-DD
  giorniTerminiPagamento?: number;
  dataScadenzaPagamento?: string; // YYYY-MM-DD
  importoPagamento: string;    // Format: 0.00
  codUfficioPostale?: string;
  cognomeQuietanzante?: string;
  nomeQuietanzante?: string;
  cfQuietanzante?: string;
  titolo?: string;
  istitutoFinanziario?: string;
  iban?: string;
  abi?: string;
  cab?: string;
  bic?: string;
  scontoPagamentoAnticipato?: string; // Format: 0.00
  dataLimitePagamentoAnticipato?: string; // YYYY-MM-DD
  penalitaPagamentiRitardati?: string; // Format: 0.00
  dataDecorrenzaPenale?: string; // YYYY-MM-DD
  codicePagamento?: string;
}

export interface DatiPagamento {
  condizioniPagamento: 'TP01' | 'TP02' | 'TP03';
  dettaglioPagamento: DettaglioPagamento[];
}

export interface Allegati {
  nomeAttachment: string;      // Filename
  algoritmoCompressione?: string;
  formatoAttachment?: string;  // MIME type
  descrizioneAttachment?: string;
  attachment: string;          // Base64 encoded content
}

export interface FatturaElettronicaBody {
  datiGenerali: {
    datiGeneraliDocumento: DatiGeneraliDocumento;
    datiOrdineAcquisto?: Array<{
      riferimentoNumeroLinea?: number[];
      idDocumento: string;
      data?: string;
      numItem?: string;
      codiceCommessaConvenzione?: string;
      codiceCUP?: string;
      codiceCIG?: string;
    }>;
    datiContratto?: Array<{
      riferimentoNumeroLinea?: number[];
      idDocumento: string;
      data?: string;
      numItem?: string;
      codiceCommessaConvenzione?: string;
      codiceCUP?: string;
      codiceCIG?: string;
    }>;
    datiConvenzione?: Array<{
      riferimentoNumeroLinea?: number[];
      idDocumento: string;
      data?: string;
      numItem?: string;
      codiceCommessaConvenzione?: string;
      codiceCUP?: string;
      codiceCIG?: string;
    }>;
    datiRicezione?: Array<{
      riferimentoNumeroLinea?: number[];
      idDocumento: string;
      data?: string;
      numItem?: string;
      codiceCommessaConvenzione?: string;
      codiceCUP?: string;
      codiceCIG?: string;
    }>;
    datiFattureCollegate?: Array<{
      riferimentoNumeroLinea?: number[];
      idDocumento: string;
      data?: string;
      numItem?: string;
      codiceCommessaConvenzione?: string;
      codiceCUP?: string;
      codiceCIG?: string;
    }>;
    datiSAL?: Array<{
      riferimentoFase: number;
    }>;
    datiDDT?: Array<{
      numeroDDT: string;
      dataDDT: string;
      riferimentoNumeroLinea?: number[];
    }>;
    datiTrasporto?: {
      datiAnagraficiVettore?: {
        idFiscaleIVA?: IdFiscaleIVA;
        codiceFiscale?: string;
        anagrafica: {
          denominazione?: string;
          nome?: string;
          cognome?: string;
          titolo?: string;
        };
        numeroLicenzaGuida?: string;
      };
      mezzoTrasporto?: string;
      causaleTrasporto?: string;
      numeroColli?: number;
      descrizione?: string;
      unitaMisuraPeso?: string;
      pesoLordo?: string;
      pesoNetto?: string;
      dataOraRitiro?: string;
      dataInizioTrasporto?: string;
      tipoResa?: string;
      indirizzoResa?: Address;
      dataOraConsegna?: string;
    };
    fatturaPrincipale?: {
      numeroFatturaPrincipale: string;
      dataFatturaPrincipale: string;
    };
  };
  datiBeniServizi: DatiBeniServizi;
  datiVeicoli?: {
    data: string;
    totalePercorso: string;
  };
  datiPagamento?: DatiPagamento[];
  allegati?: Allegati[];
}

export interface DatiTrasmissione {
  idTrasmittente: IdFiscaleIVA;
  progressivoInvio: string;    // Progressive number (1-5 digits)
  formatoTrasmissione: 'FPR12' | 'FPA12'; // FPR12=simplified, FPA12=regular
  codiceDestinatario?: string; // 7-char code or '0000000' for PEC
  contatti0Trasmittente?: {
    telefono?: string;
    email?: string;
  };
  pecDestinatario?: string;    // PEC email address
}

export interface FatturaElettronica {
  fatturaElettronicaHeader: {
    datiTrasmissione: DatiTrasmissione;
    cedentePrestatore: CedentePrestatore;
    rappresentanteFiscale?: {
      datiAnagrafici: DatiAnagrafici;
    };
    cessionarioCommittente: CessionarioCommittente;
    terzoIntermediarioOSoggettoEmittente?: {
      datiAnagrafici: DatiAnagrafici;
    };
    soggettoEmittente?: 'CC' | 'TZ'; // CC=cedente, TZ=terzo
  };
  fatturaElettronicaBody: FatturaElettronicaBody[];
}

export interface SDIInvoiceRequest {
  invoice: FatturaElettronica;
  outputFormat?: 'xml' | 's3' | 'url'; // xml=return XML, s3=upload to S3, url=presigned URL
  validate?: boolean;          // Validate against XSD (default: true)
  filename?: string;           // Custom filename (auto-generated if not provided)
}

export interface SDIInvoiceResponse {
  success: boolean;
  xml?: string;                // XML content (if outputFormat=xml)
  s3Url?: string;              // S3 URL (if outputFormat=s3)
  presignedUrl?: string;       // Presigned URL (if outputFormat=url)
  s3Key?: string;              // S3 key
  filename: string;            // Generated filename
  size: number;                // XML size in bytes
  generationTime: number;      // Time in milliseconds
  validationErrors?: string[]; // XSD validation errors
  error?: string;
  message?: string;
  requestId?: string;
}

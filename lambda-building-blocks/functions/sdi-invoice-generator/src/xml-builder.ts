/**
 * FatturaPA XML Builder
 * Generates Italian electronic invoice XML according to FatturaPA v1.2.2 specification
 */

import { create } from 'xmlbuilder2';
import { FatturaElettronica } from './types';
import { sanitizePhoneNumber } from './validators';

/**
 * Build FatturaPA XML from invoice data
 *
 * @param invoice - Invoice data conforming to FatturaPA structure
 * @returns XML string
 */
export function buildFatturaXML(invoice: FatturaElettronica): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('FatturaElettronica', {
      'xmlns': 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      versione: invoice.fatturaElettronicaHeader.datiTrasmissione.formatoTrasmissione
    });

  // FatturaElettronicaHeader (with empty namespace to override default)
  const header = root.ele('FatturaElettronicaHeader', { xmlns: '' });

  // DatiTrasmissione
  const datiTrasmissione = header.ele('DatiTrasmissione');
  const idTrasmittente = datiTrasmissione.ele('IdTrasmittente');
  idTrasmittente.ele('IdPaese').txt(invoice.fatturaElettronicaHeader.datiTrasmissione.idTrasmittente.idPaese);
  idTrasmittente.ele('IdCodice').txt(invoice.fatturaElettronicaHeader.datiTrasmissione.idTrasmittente.idCodice);
  datiTrasmissione.ele('ProgressivoInvio').txt(invoice.fatturaElettronicaHeader.datiTrasmissione.progressivoInvio);
  datiTrasmissione.ele('FormatoTrasmissione').txt(invoice.fatturaElettronicaHeader.datiTrasmissione.formatoTrasmissione);

  if (invoice.fatturaElettronicaHeader.datiTrasmissione.codiceDestinatario) {
    datiTrasmissione.ele('CodiceDestinatario').txt(invoice.fatturaElettronicaHeader.datiTrasmissione.codiceDestinatario);
  }

  if (invoice.fatturaElettronicaHeader.datiTrasmissione.contatti0Trasmittente) {
    const contatti = datiTrasmissione.ele('ContattiTrasmittente');
    if (invoice.fatturaElettronicaHeader.datiTrasmissione.contatti0Trasmittente.telefono) {
      contatti.ele('Telefono').txt(sanitizePhoneNumber(invoice.fatturaElettronicaHeader.datiTrasmissione.contatti0Trasmittente.telefono));
    }
    if (invoice.fatturaElettronicaHeader.datiTrasmissione.contatti0Trasmittente.email) {
      contatti.ele('Email').txt(invoice.fatturaElettronicaHeader.datiTrasmissione.contatti0Trasmittente.email);
    }
  }

  if (invoice.fatturaElettronicaHeader.datiTrasmissione.pecDestinatario) {
    datiTrasmissione.ele('PECDestinatario').txt(invoice.fatturaElettronicaHeader.datiTrasmissione.pecDestinatario);
  }

  // CedentePrestatore
  const cedente = header.ele('CedentePrestatore');
  addDatiAnagrafici(cedente.ele('DatiAnagrafici'), invoice.fatturaElettronicaHeader.cedentePrestatore.datiAnagrafici);
  addSede(cedente.ele('Sede'), invoice.fatturaElettronicaHeader.cedentePrestatore.sede);

  if (invoice.fatturaElettronicaHeader.cedentePrestatore.stabile0rganizzazione) {
    addSede(cedente.ele('StabileOrganizzazione'), invoice.fatturaElettronicaHeader.cedentePrestatore.stabile0rganizzazione);
  }

  if (invoice.fatturaElettronicaHeader.cedentePrestatore.iscrizioneREA) {
    const rea = cedente.ele('IscrizioneREA');
    rea.ele('Ufficio').txt(invoice.fatturaElettronicaHeader.cedentePrestatore.iscrizioneREA.ufficio);
    rea.ele('NumeroREA').txt(invoice.fatturaElettronicaHeader.cedentePrestatore.iscrizioneREA.numeroREA);
    if (invoice.fatturaElettronicaHeader.cedentePrestatore.iscrizioneREA.capitaleSociale) {
      rea.ele('CapitaleSociale').txt(invoice.fatturaElettronicaHeader.cedentePrestatore.iscrizioneREA.capitaleSociale);
    }
    if (invoice.fatturaElettronicaHeader.cedentePrestatore.iscrizioneREA.socioUnico) {
      rea.ele('SocioUnico').txt(invoice.fatturaElettronicaHeader.cedentePrestatore.iscrizioneREA.socioUnico);
    }
    rea.ele('StatoLiquidazione').txt(invoice.fatturaElettronicaHeader.cedentePrestatore.iscrizioneREA.statoLiquidazione);
  }

  if (invoice.fatturaElettronicaHeader.cedentePrestatore.contatti) {
    const contatti = cedente.ele('Contatti');
    if (invoice.fatturaElettronicaHeader.cedentePrestatore.contatti.telefono) {
      contatti.ele('Telefono').txt(sanitizePhoneNumber(invoice.fatturaElettronicaHeader.cedentePrestatore.contatti.telefono));
    }
    if (invoice.fatturaElettronicaHeader.cedentePrestatore.contatti.fax) {
      contatti.ele('Fax').txt(sanitizePhoneNumber(invoice.fatturaElettronicaHeader.cedentePrestatore.contatti.fax));
    }
    if (invoice.fatturaElettronicaHeader.cedentePrestatore.contatti.email) {
      contatti.ele('Email').txt(invoice.fatturaElettronicaHeader.cedentePrestatore.contatti.email);
    }
  }

  if (invoice.fatturaElettronicaHeader.cedentePrestatore.riferimentoAmministrazione) {
    cedente.ele('RiferimentoAmministrazione').txt(invoice.fatturaElettronicaHeader.cedentePrestatore.riferimentoAmministrazione);
  }

  // RappresentanteFiscale (optional)
  if (invoice.fatturaElettronicaHeader.rappresentanteFiscale) {
    const rappresentante = header.ele('RappresentanteFiscale');
    addDatiAnagrafici(rappresentante.ele('DatiAnagrafici'), invoice.fatturaElettronicaHeader.rappresentanteFiscale.datiAnagrafici);
  }

  // CessionarioCommittente
  const cessionario = header.ele('CessionarioCommittente');
  addDatiAnagrafici(cessionario.ele('DatiAnagrafici'), invoice.fatturaElettronicaHeader.cessionarioCommittente.datiAnagrafici);
  addSede(cessionario.ele('Sede'), invoice.fatturaElettronicaHeader.cessionarioCommittente.sede);

  if (invoice.fatturaElettronicaHeader.cessionarioCommittente.stabileOrganizzazione) {
    addSede(cessionario.ele('StabileOrganizzazione'), invoice.fatturaElettronicaHeader.cessionarioCommittente.stabileOrganizzazione);
  }

  if (invoice.fatturaElettronicaHeader.cessionarioCommittente.rappresentanteFiscale) {
    const rappFiscale = cessionario.ele('RappresentanteFiscale');
    const idFiscale = rappFiscale.ele('IdFiscaleIVA');
    idFiscale.ele('IdPaese').txt(invoice.fatturaElettronicaHeader.cessionarioCommittente.rappresentanteFiscale.idFiscaleIVA.idPaese);
    idFiscale.ele('IdCodice').txt(invoice.fatturaElettronicaHeader.cessionarioCommittente.rappresentanteFiscale.idFiscaleIVA.idCodice);
    rappFiscale.ele('Denominazione').txt(invoice.fatturaElettronicaHeader.cessionarioCommittente.rappresentanteFiscale.denominazione);
  }

  // TerzoIntermediarioOSoggettoEmittente (optional)
  if (invoice.fatturaElettronicaHeader.terzoIntermediarioOSoggettoEmittente) {
    const terzo = header.ele('TerzoIntermediarioOSoggettoEmittente');
    addDatiAnagrafici(terzo.ele('DatiAnagrafici'), invoice.fatturaElettronicaHeader.terzoIntermediarioOSoggettoEmittente.datiAnagrafici);
  }

  // SoggettoEmittente (optional)
  if (invoice.fatturaElettronicaHeader.soggettoEmittente) {
    header.ele('SoggettoEmittente').txt(invoice.fatturaElettronicaHeader.soggettoEmittente);
  }

  // FatturaElettronicaBody (can have multiple, with empty namespace to override default)
  for (const body of invoice.fatturaElettronicaBody) {
    const bodyEle = root.ele('FatturaElettronicaBody', { xmlns: '' });

    // DatiGenerali
    const datiGenerali = bodyEle.ele('DatiGenerali');
    addDatiGeneraliDocumento(datiGenerali.ele('DatiGeneraliDocumento'), body.datiGenerali.datiGeneraliDocumento);

    // DatiOrdineAcquisto (optional, multiple)
    if (body.datiGenerali.datiOrdineAcquisto) {
      for (const ordine of body.datiGenerali.datiOrdineAcquisto) {
        const ordineEle = datiGenerali.ele('DatiOrdineAcquisto');
        if (ordine.riferimentoNumeroLinea) {
          for (const linea of ordine.riferimentoNumeroLinea) {
            ordineEle.ele('RiferimentoNumeroLinea').txt(String(linea));
          }
        }
        ordineEle.ele('IdDocumento').txt(ordine.idDocumento);
        if (ordine.data) ordineEle.ele('Data').txt(ordine.data);
        if (ordine.numItem) ordineEle.ele('NumItem').txt(ordine.numItem);
        if (ordine.codiceCommessaConvenzione) ordineEle.ele('CodiceCommessaConvenzione').txt(ordine.codiceCommessaConvenzione);
        if (ordine.codiceCUP) ordineEle.ele('CodiceCUP').txt(ordine.codiceCUP);
        if (ordine.codiceCIG) ordineEle.ele('CodiceCIG').txt(ordine.codiceCIG);
      }
    }

    // DatiDDT (optional, multiple)
    if (body.datiGenerali.datiDDT) {
      for (const ddt of body.datiGenerali.datiDDT) {
        const ddtEle = datiGenerali.ele('DatiDDT');
        ddtEle.ele('NumeroDDT').txt(ddt.numeroDDT);
        ddtEle.ele('DataDDT').txt(ddt.dataDDT);
        if (ddt.riferimentoNumeroLinea) {
          for (const linea of ddt.riferimentoNumeroLinea) {
            ddtEle.ele('RiferimentoNumeroLinea').txt(String(linea));
          }
        }
      }
    }

    // DatiBeniServizi
    const datiBeniServizi = bodyEle.ele('DatiBeniServizi');

    // DettaglioLinee (multiple)
    for (const dettaglio of body.datiBeniServizi.dettaglioLinee) {
      const lineaEle = datiBeniServizi.ele('DettaglioLinee');
      lineaEle.ele('NumeroLinea').txt(String(dettaglio.numeroLinea));

      if (dettaglio.tipoCessionePrestazione) {
        lineaEle.ele('TipoCessionePrestazione').txt(dettaglio.tipoCessionePrestazione);
      }

      if (dettaglio.codiceArticolo) {
        for (const codice of dettaglio.codiceArticolo) {
          const codiceEle = lineaEle.ele('CodiceArticolo');
          codiceEle.ele('CodiceTipo').txt(codice.codiceTipo);
          codiceEle.ele('CodiceValore').txt(codice.codiceValore);
        }
      }

      lineaEle.ele('Descrizione').txt(dettaglio.descrizione);

      if (dettaglio.quantita) {
        lineaEle.ele('Quantita').txt(dettaglio.quantita);
      }

      if (dettaglio.unitaMisura) {
        lineaEle.ele('UnitaMisura').txt(dettaglio.unitaMisura);
      }

      if (dettaglio.dataInizioPeriodo) {
        lineaEle.ele('DataInizioPeriodo').txt(dettaglio.dataInizioPeriodo);
      }

      if (dettaglio.dataFinePeriodo) {
        lineaEle.ele('DataFinePeriodo').txt(dettaglio.dataFinePeriodo);
      }

      lineaEle.ele('PrezzoUnitario').txt(dettaglio.prezzoUnitario);

      if (dettaglio.scontoMaggiorazione) {
        for (const sconto of dettaglio.scontoMaggiorazione) {
          const scontoEle = lineaEle.ele('ScontoMaggiorazione');
          scontoEle.ele('Tipo').txt(sconto.tipo);
          if (sconto.percentuale) {
            scontoEle.ele('Percentuale').txt(sconto.percentuale);
          }
          if (sconto.importo) {
            scontoEle.ele('Importo').txt(sconto.importo);
          }
        }
      }

      lineaEle.ele('PrezzoTotale').txt(dettaglio.prezzoTotale);
      lineaEle.ele('AliquotaIVA').txt(dettaglio.aliquotaIVA);

      if (dettaglio.ritenuta) {
        lineaEle.ele('Ritenuta').txt(dettaglio.ritenuta);
      }

      if (dettaglio.natura) {
        lineaEle.ele('Natura').txt(dettaglio.natura);
      }

      if (dettaglio.riferimentoAmministrazione) {
        lineaEle.ele('RiferimentoAmministrazione').txt(dettaglio.riferimentoAmministrazione);
      }

      if (dettaglio.altriDatiGestionali) {
        for (const altri of dettaglio.altriDatiGestionali) {
          const altriEle = lineaEle.ele('AltriDatiGestionali');
          altriEle.ele('TipoDato').txt(altri.tipoDato);
          if (altri.riferimentoTesto) {
            altriEle.ele('RiferimentoTesto').txt(altri.riferimentoTesto);
          }
          if (altri.riferimentoNumero) {
            altriEle.ele('RiferimentoNumero').txt(altri.riferimentoNumero);
          }
          if (altri.riferimentoData) {
            altriEle.ele('RiferimentoData').txt(altri.riferimentoData);
          }
        }
      }
    }

    // DatiRiepilogo (multiple)
    for (const riepilogo of body.datiBeniServizi.datiRiepilogo) {
      const riepilogoEle = datiBeniServizi.ele('DatiRiepilogo');
      riepilogoEle.ele('AliquotaIVA').txt(riepilogo.aliquotaIVA);

      if (riepilogo.natura) {
        riepilogoEle.ele('Natura').txt(riepilogo.natura);
      }

      if (riepilogo.speseAccessorie) {
        riepilogoEle.ele('SpeseAccessorie').txt(riepilogo.speseAccessorie);
      }

      if (riepilogo.arrotondamento) {
        riepilogoEle.ele('Arrotondamento').txt(riepilogo.arrotondamento);
      }

      riepilogoEle.ele('ImponibileImporto').txt(riepilogo.imponibileImporto);
      riepilogoEle.ele('Imposta').txt(riepilogo.imposta);

      if (riepilogo.esigibilitaIVA) {
        riepilogoEle.ele('EsigibilitaIVA').txt(riepilogo.esigibilitaIVA);
      }

      if (riepilogo.riferimentoNormativo) {
        riepilogoEle.ele('RiferimentoNormativo').txt(riepilogo.riferimentoNormativo);
      }
    }

    // DatiPagamento (optional, multiple)
    if (body.datiPagamento) {
      for (const pagamento of body.datiPagamento) {
        const pagamentoEle = bodyEle.ele('DatiPagamento');
        pagamentoEle.ele('CondizioniPagamento').txt(pagamento.condizioniPagamento);

        for (const dettaglio of pagamento.dettaglioPagamento) {
          const dettaglioEle = pagamentoEle.ele('DettaglioPagamento');

          if (dettaglio.beneficiario) {
            dettaglioEle.ele('Beneficiario').txt(dettaglio.beneficiario);
          }

          dettaglioEle.ele('ModalitaPagamento').txt(dettaglio.modalitaPagamento);

          if (dettaglio.dataRiferimentoTerminiPagamento) {
            dettaglioEle.ele('DataRiferimentoTerminiPagamento').txt(dettaglio.dataRiferimentoTerminiPagamento);
          }

          if (dettaglio.giorniTerminiPagamento) {
            dettaglioEle.ele('GiorniTerminiPagamento').txt(String(dettaglio.giorniTerminiPagamento));
          }

          if (dettaglio.dataScadenzaPagamento) {
            dettaglioEle.ele('DataScadenzaPagamento').txt(dettaglio.dataScadenzaPagamento);
          }

          dettaglioEle.ele('ImportoPagamento').txt(dettaglio.importoPagamento);

          if (dettaglio.codUfficioPostale) {
            dettaglioEle.ele('CodUfficioPostale').txt(dettaglio.codUfficioPostale);
          }

          if (dettaglio.cognomeQuietanzante) {
            dettaglioEle.ele('CognomeQuietanzante').txt(dettaglio.cognomeQuietanzante);
          }

          if (dettaglio.nomeQuietanzante) {
            dettaglioEle.ele('NomeQuietanzante').txt(dettaglio.nomeQuietanzante);
          }

          if (dettaglio.cfQuietanzante) {
            dettaglioEle.ele('CFQuietanzante').txt(dettaglio.cfQuietanzante);
          }

          if (dettaglio.titolo) {
            dettaglioEle.ele('Titolo').txt(dettaglio.titolo);
          }

          if (dettaglio.istitutoFinanziario) {
            dettaglioEle.ele('IstitutoFinanziario').txt(dettaglio.istitutoFinanziario);
          }

          if (dettaglio.iban) {
            dettaglioEle.ele('IBAN').txt(dettaglio.iban);
          }

          if (dettaglio.abi) {
            dettaglioEle.ele('ABI').txt(dettaglio.abi);
          }

          if (dettaglio.cab) {
            dettaglioEle.ele('CAB').txt(dettaglio.cab);
          }

          if (dettaglio.bic) {
            dettaglioEle.ele('BIC').txt(dettaglio.bic);
          }

          if (dettaglio.scontoPagamentoAnticipato) {
            dettaglioEle.ele('ScontoPagamentoAnticipato').txt(dettaglio.scontoPagamentoAnticipato);
          }

          if (dettaglio.dataLimitePagamentoAnticipato) {
            dettaglioEle.ele('DataLimitePagamentoAnticipato').txt(dettaglio.dataLimitePagamentoAnticipato);
          }

          if (dettaglio.penalitaPagamentiRitardati) {
            dettaglioEle.ele('PenalitaPagamentiRitardati').txt(dettaglio.penalitaPagamentiRitardati);
          }

          if (dettaglio.dataDecorrenzaPenale) {
            dettaglioEle.ele('DataDecorrenzaPenale').txt(dettaglio.dataDecorrenzaPenale);
          }

          if (dettaglio.codicePagamento) {
            dettaglioEle.ele('CodicePagamento').txt(dettaglio.codicePagamento);
          }
        }
      }
    }

    // Allegati (optional, multiple)
    if (body.allegati) {
      for (const allegato of body.allegati) {
        const allegatoEle = bodyEle.ele('Allegati');
        allegatoEle.ele('NomeAttachment').txt(allegato.nomeAttachment);

        if (allegato.algoritmoCompressione) {
          allegatoEle.ele('AlgoritmoCompressione').txt(allegato.algoritmoCompressione);
        }

        if (allegato.formatoAttachment) {
          allegatoEle.ele('FormatoAttachment').txt(allegato.formatoAttachment);
        }

        if (allegato.descrizioneAttachment) {
          allegatoEle.ele('DescrizioneAttachment').txt(allegato.descrizioneAttachment);
        }

        allegatoEle.ele('Attachment').txt(allegato.attachment);
      }
    }
  }

  let xml = root.end({ prettyPrint: true });

  // Post-process: Remove redundant xmlns="" declarations
  // Keep xmlns="" ONLY on FatturaElettronicaHeader and FatturaElettronicaBody
  // Remove it from all child elements (xmlbuilder2 adds them automatically)

  // Pattern: Match any element with xmlns="" that is NOT FatturaElettronicaHeader or FatturaElettronicaBody
  xml = xml.replace(
    /<(?!FatturaElettronicaHeader|FatturaElettronicaBody)([A-Za-z0-9]+)\s+xmlns=""/g,
    '<$1'
  );

  return xml;
}

/**
 * Helper function to add DatiAnagrafici to XML
 */
function addDatiAnagrafici(parent: any, dati: any): void {
  if (dati.idFiscaleIVA) {
    const idFiscale = parent.ele('IdFiscaleIVA');
    idFiscale.ele('IdPaese').txt(dati.idFiscaleIVA.idPaese);
    idFiscale.ele('IdCodice').txt(dati.idFiscaleIVA.idCodice);
  }

  if (dati.codiceFiscale) {
    parent.ele('CodiceFiscale').txt(dati.codiceFiscale);
  }

  const anagrafica = parent.ele('Anagrafica');
  if (dati.anagrafica.denominazione) {
    anagrafica.ele('Denominazione').txt(dati.anagrafica.denominazione);
  }
  if (dati.anagrafica.nome) {
    anagrafica.ele('Nome').txt(dati.anagrafica.nome);
  }
  if (dati.anagrafica.cognome) {
    anagrafica.ele('Cognome').txt(dati.anagrafica.cognome);
  }
  if (dati.anagrafica.titolo) {
    anagrafica.ele('Titolo').txt(dati.anagrafica.titolo);
  }

  if (dati.alboProfessionale) {
    parent.ele('AlboProfessionale').txt(dati.alboProfessionale);
  }

  if (dati.provinciaAlbo) {
    parent.ele('ProvinciaAlbo').txt(dati.provinciaAlbo);
  }

  if (dati.numeroIscrizioneAlbo) {
    parent.ele('NumeroIscrizioneAlbo').txt(dati.numeroIscrizioneAlbo);
  }

  if (dati.dataIscrizioneAlbo) {
    parent.ele('DataIscrizioneAlbo').txt(dati.dataIscrizioneAlbo);
  }

  if (dati.regimeFiscale) {
    parent.ele('RegimeFiscale').txt(dati.regimeFiscale);
  }
}

/**
 * Helper function to add Sede to XML
 */
function addSede(parent: any, sede: any): void {
  parent.ele('Indirizzo').txt(sede.indirizzo);
  if (sede.numeroCivico) {
    parent.ele('NumeroCivico').txt(sede.numeroCivico);
  }
  parent.ele('CAP').txt(sede.cap);
  parent.ele('Comune').txt(sede.comune);
  if (sede.provincia) {
    parent.ele('Provincia').txt(sede.provincia);
  }
  parent.ele('Nazione').txt(sede.nazione);
}

/**
 * Helper function to add DatiGeneraliDocumento to XML
 */
function addDatiGeneraliDocumento(parent: any, dati: any): void {
  parent.ele('TipoDocumento').txt(dati.tipoDocumento);
  parent.ele('Divisa').txt(dati.divisa);
  parent.ele('Data').txt(dati.data);
  parent.ele('Numero').txt(dati.numero);

  if (dati.datiRitenuta) {
    const ritenuta = parent.ele('DatiRitenuta');
    ritenuta.ele('TipoRitenuta').txt(dati.datiRitenuta.tipoRitenuta);
    ritenuta.ele('ImportoRitenuta').txt(dati.datiRitenuta.importoRitenuta);
    ritenuta.ele('AliquotaRitenuta').txt(dati.datiRitenuta.aliquotaRitenuta);
    ritenuta.ele('CausalePagamento').txt(dati.datiRitenuta.causalePagamento);
  }

  if (dati.datiBollo) {
    const bollo = parent.ele('DatiBollo');
    bollo.ele('BolloVirtuale').txt(dati.datiBollo.bolloVirtuale);
    bollo.ele('ImportoBollo').txt(dati.datiBollo.importoBollo);
  }

  if (dati.scontoMaggiorazione) {
    for (const sconto of dati.scontoMaggiorazione) {
      const scontoEle = parent.ele('ScontoMaggiorazione');
      scontoEle.ele('Tipo').txt(sconto.tipo);
      if (sconto.percentuale) {
        scontoEle.ele('Percentuale').txt(sconto.percentuale);
      }
      if (sconto.importo) {
        scontoEle.ele('Importo').txt(sconto.importo);
      }
    }
  }

  if (dati.importoTotaleDocumento) {
    parent.ele('ImportoTotaleDocumento').txt(dati.importoTotaleDocumento);
  }

  if (dati.arrotondamento) {
    parent.ele('Arrotondamento').txt(dati.arrotondamento);
  }

  if (dati.causale) {
    for (const causale of dati.causale) {
      parent.ele('Causale').txt(causale);
    }
  }

  if (dati.art73) {
    parent.ele('Art73').txt(dati.art73);
  }
}

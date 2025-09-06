import { Transaction, TransactionInput } from './types';
import { UTXOPoolManager } from './utxo-pool';
import { verify } from './utils/crypto';
import {
  ValidationResult,
  ValidationError,
  VALIDATION_ERRORS,
  createValidationError
} from './errors';

export class TransactionValidator {
  constructor(private utxoPool: UTXOPoolManager) {}

  /**
   * Validate a transaction
   * @param {Transaction} transaction - The transaction to validate
   * @returns {ValidationResult} The validation result
   */
  validateTransaction(transaction: Transaction): ValidationResult {
    const errors: ValidationError[] = [];
    
    let totalInputAmount = 0;
    let totalOutputAmount = 0;

    const usedUTXOs = new Set<string>();
    
    for (const input of transaction.inputs) {
      const utxoKey = `${input.utxoId.txId}:${input.utxoId.outputIndex}`;

      // Verificar doble existencia usando el set
      if (usedUTXOs.has(utxoKey)) {
        errors.push(createValidationError(VALIDATION_ERRORS.DOUBLE_SPENDING,`UTXO ${utxoKey} usado múltiples veces`));
        continue;
      }
      usedUTXOs.add(utxoKey);

      // Verificar existencia en el pool
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);

      if (!utxo) {
        errors.push(createValidationError(VALIDATION_ERRORS.UTXO_NOT_FOUND, `${input.utxoId.txId}:${input.utxoId.outputIndex}`));
        continue;
      }

      // Verificar firma
      const transactionData = this.createTransactionDataForSigning_(transaction);
      const isValid = verify(transactionData, input.signature, utxo.recipient);
      if(!isValid) {
        errors.push(createValidationError(VALIDATION_ERRORS.INVALID_SIGNATURE, `UTXO: ${input.utxoId.txId}:${input.utxoId.outputIndex}`));
        continue;
      }

      totalInputAmount += utxo.amount;
    }
    
    for (const output of transaction.outputs) { 
      // Validar que las salidas no sean cero
      if (output.amount == 0) {
        errors.push(createValidationError(VALIDATION_ERRORS.ZERO_AMOUNT_OUTPUTS, `Output amount must not be 0: ${output.amount}`));
      }
      totalOutputAmount += output.amount;      
    }
    
    // Validar que el total de entradas sea igual al total de salidas
    if(totalInputAmount !== totalOutputAmount) {
      errors.push(createValidationError(VALIDATION_ERRORS.AMOUNT_MISMATCH, `Input total: ${totalInputAmount}, Output total: ${totalOutputAmount}`));
    }
      
    return {
      valid: errors.length === 0,
      errors
    };
  }


  /**
   * Create a deterministic string representation of the transaction for signing
   * This excludes the signatures to prevent circular dependencies
   * @param {Transaction} transaction - The transaction to create a data for signing
   * @returns {string} The string representation of the transaction for signing
   */
  private createTransactionDataForSigning_(transaction: Transaction): string {
    const unsignedTx = {
      id: transaction.id,
      inputs: transaction.inputs.map(input => ({
        utxoId: input.utxoId,
        owner: input.owner
      })),
      outputs: transaction.outputs,
      timestamp: transaction.timestamp
    };

    return JSON.stringify(unsignedTx);
  }
}

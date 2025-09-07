
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

    transaction.outputs.forEach(out => {
      if(out.amount == 0) errors.push(createValidationError(
        VALIDATION_ERRORS.ZERO_AMOUNT_OUTPUTS,
        `Zero amount output: ${out.amount}-${out.recipient}`
      ))
    });

    transaction.inputs.forEach((inp) => {
      if(!this.utxoPool.getUTXO(inp.utxoId.txId, inp.utxoId.outputIndex)) errors.push(createValidationError(
        VALIDATION_ERRORS.UTXO_NOT_FOUND, 
        `UTXO not found in pool: ${inp.utxoId.txId}:${inp.utxoId.outputIndex}`
      ))
    })

    const inputAmount = transaction.inputs.reduce((acc, inp) => acc + (this.utxoPool.getUTXO(inp.utxoId.txId, inp.utxoId.outputIndex)?.amount ?? 0), 0);
    const outputAmount = transaction.outputs.reduce((acc, out) => acc + out.amount, 0);
    if(inputAmount !== outputAmount) errors.push(createValidationError(
      VALIDATION_ERRORS.AMOUNT_MISMATCH, 
      "Invalid transaction: the amount of inputs must equal outputs."
    ))

    const txData = this.createTransactionDataForSigning_(transaction);
    transaction.inputs.forEach(inp => {
      if(!verify(txData, inp.signature, inp.owner)) errors.push(createValidationError(
        VALIDATION_ERRORS.INVALID_SIGNATURE,
        `Invalid sign: ${inp.owner} - ${inp.signature}`
      ))
    })

    let utxoSet = new Set<string>;
    transaction.inputs.forEach(inp => {
      const oldLength = utxoSet.size;
      utxoSet.add(`${inp.utxoId.txId},${inp.utxoId.outputIndex}`)
      if(oldLength == utxoSet.size) errors.push(createValidationError(
        VALIDATION_ERRORS.DOUBLE_SPENDING,
        `UTXO repeated: ${inp.utxoId.txId}:${inp.utxoId.outputIndex}`
      ))
    })

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

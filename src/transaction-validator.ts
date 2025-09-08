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
		let inputAmount = 0;
		let outputAmount = 0;

		if(transaction.inputs.length === 0){
			errors.push(createValidationError(
				VALIDATION_ERRORS.EMPTY_INPUTS,
				'Empty amount of inputs' )
			);
		}
		if(transaction.outputs.length === 0){
			errors.push(createValidationError(
				VALIDATION_ERRORS.EMPTY_OUTPUTS,
				'Empty amount of outputs' )
			);
		}

		const usedUtxos = new UTXOPoolManager();

		for(const input of transaction.inputs){
			const anUTXO = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
			if(!anUTXO){
				errors.push(createValidationError(
					VALIDATION_ERRORS.UTXO_NOT_FOUND,
					'UTXO not found: ${input.utxoId.txId}:${input.utxoId.outputIndex}')
				);
			}
			if(anUTXO){
				const existe = usedUtxos.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
				if(!existe){
					usedUtxos.addUTXO(anUTXO);	
				}else{
					errors.push(createValidationError(
						VALIDATION_ERRORS.DOUBLE_SPENDING,
						'There is already an existing UXTO with this id and outputIndex')
					);
				}
				const transactionData = this.createTransactionDataForSigning_(transaction);
				const isValid = verify(transactionData, input.signature, input.owner);

				if(!isValid){
					errors.push(createValidationError(
						VALIDATION_ERRORS.INVALID_SIGNATURE,
						'The signature was invalid ${input.signature}')	
					);
				}
				inputAmount += anUTXO.amount;
			}
		}

		for(const output of transaction.outputs){
			if(output.amount <= 0){
				errors.push(createValidationError(
					VALIDATION_ERRORS.NEGATIVE_AMOUNT,
					'The amount in the output was negative or zero')
				);
			}
			outputAmount += output.amount;
		}

		if(outputAmount != inputAmount){
			errors.push(createValidationError(
				VALIDATION_ERRORS.AMOUNT_MISMATCH,
				'The input and output amounts dont match' )
			);
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

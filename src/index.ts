import { UTXOPoolManager } from './utxo-pool';
import { generateKeyPair } from './utils/crypto';
import { getEncodingEfficiency } from './utils/binary-encoding';

import { TransactionBuilder } from './transaction-builder';

// Demo script showing the UTXO system in action
function main() {
  console.log('🚀 Simplified UTXO System Demo\n');

  // Generate key pairs for our users
  const alice = generateKeyPair();
  const bob = generateKeyPair();
  const charlie = generateKeyPair();

  console.log('👥 Generated key pairs for Alice, Bob, and Charlie');

  // Create UTXO pool and initialize with genesis UTXOs
  const utxoPool = new UTXOPoolManager();
  utxoPool.createGenesisUTXOs({
    [alice.publicKey]: 1000,
    [bob.publicKey]: 500,
    [charlie.publicKey]: 250
  });

  console.log('\n💰 Initial balances:');
  console.log(`Alice: ${utxoPool.getBalance(alice.publicKey)}`);
  console.log(`Bob: ${utxoPool.getBalance(bob.publicKey)}`);
  console.log(`Charlie: ${utxoPool.getBalance(charlie.publicKey)}`);

  // Transaction 1: Alice sends 300 to Bob (demo without validation)
  console.log('\n📝 Transaction 1: Alice sends 300 to Bob');
  const aliceUTXOs = utxoPool.getUTXOsForOwner(alice.publicKey);
  const tx1 = TransactionBuilder.createTransaction(
    [{ utxo: aliceUTXOs[0], privateKey: alice.privateKey }],
    [
      { amount: 300, recipient: bob.publicKey },
      { amount: 700, recipient: alice.publicKey }
    ]
  );

  console.log('✅ Transaction created and signed successfully');
  console.log(`Transaction ID: ${tx1.id}`);

  // Process transaction directly (bypassing validation for demo)
  utxoPool.processTransaction(tx1);
  console.log('Transaction processed');

  // Transaction 2: Bob sends 150 to Charlie
  console.log('\n📝 Transaction 2: Bob sends 150 to Charlie');
  const bobUTXOs = utxoPool.getUTXOsForOwner(bob.publicKey);
  const bobNewUTXO = bobUTXOs.find(u => u.id.txId === tx1.id);

  if (bobNewUTXO) {
    const tx2 = TransactionBuilder.createTransaction(
      [{ utxo: bobNewUTXO, privateKey: bob.privateKey }],
      [
        { amount: 150, recipient: charlie.publicKey },
        { amount: 150, recipient: bob.publicKey }
      ]
    );

    console.log('✅ Transaction created and signed successfully');
    console.log(`Transaction ID: ${tx2.id}`);

    utxoPool.processTransaction(tx2);
    console.log('Transaction processed');
  }
  console.log(getEncodingEfficiency(tx1));
  // Final balances
  console.log('\n💰 Final balances:');
  console.log(`Alice: ${utxoPool.getBalance(alice.publicKey)}`);
  console.log(`Bob: ${utxoPool.getBalance(bob.publicKey)}`);
  console.log(`Charlie: ${utxoPool.getBalance(charlie.publicKey)}`);

  console.log('\n🎯 Demo completed!');
  console.log(
    '\n📚 Your assignment: implement transaction validation in src/transaction-validator.ts'
  );
  console.log('🧪 Run tests with: npm test');
}

if (require.main === module) {
  main();
}

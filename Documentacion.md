
# Buena documentación

## Detalles generales

El entregable me resultó un poco complicado al principio, esto se ramifica de mi poca familiaridad con las tecnologías en uso además de un código nuevo al que me tuve que adaptar. Al momento de empezar a implementar los primeros requerimientos se me hizo más fácil, en especial gracias a los ejemplos de uso que aparecían en el 'ASSIGNMENT.md'.

Empecé de arriba hacia abajo, incluyendo los requerimientos de a uno. Incluso siendo el primer requerimiento el más fácil, fue el que más tiempo me llevó (detalles de implementación y dudas en el subtítulo 2).

Tuve que configurar mi computadora entera con npm y jest, además de actualizar mi path por el mal funcionamiento de jest, todo esto con ayuda de una IA generativa. También repasé lo dado en clase, siendo lo que más me trabó al principio, ya que me había olvidado que en un solo UTXO existían varias transacciones.

## Requerimientos implementados y sus fundamentos

**1.** El primer requerimiento que implementé fue el de encontrar un UTXO válido. Mis dificultades rondaron a través de que al principio yo intenté conseguir el UTXO de esta manera `const anUTXO = this.utxoPool.getUTXO(transaction.Id, ??????????);` pensando que tenía que usar la transacción enviada por parámetro en la función. Como se puede observar, podía conseguir una Id que era lo que pedía la función, pero luego no podía poner nada válido en la segunda parte. Una vez me di cuenta que tenía que usar la lista inputs y outputs dentro de la transacción para usar esa función, fue simplemente utilizar un for loop que iterase por los inputs y usar la línea de código en la versión final.

**2.** Este requerimieto fue implementado con muchos menos problemas. Solo tuve que agregar un acumulador al principio de la función, que se vaya acumulando en el for loop que se usó para conseguir los UTXOs del requerimiento anterior, y para ir agregando en el acumulador de los outputs simplemente hice otro for loop sobre los outputs que los agregaba al acumulador.

**3.** En este requerimiento simplemente apliqué lo mismo que en las pistas de implementación dentro del for loop de los inputs, y chequeé con un if statement si este era válido.

**4.** El cuarto requerimiento se me dificultó un poco, pero no mucho. Al final me terminó quedando algo muy parecido al segundo requerimiento. En vez de usar un acumulador de cantidad como en los outputs e inputs, simplemente usé un utxoPoolManager de UTXOs usados en el cual chequeaba la existencia de cada UTXO para saber si ya fue utilizado. De esa manera acumulaba los UTXOs vencidos para no utilizarlos de vuelta.

**Extra:** Chequear que no haya transacciones vacías. Lo único que hice fue contar si las listas de inputs o outputs estaban vacías.

## Bonus

Fue muy difícil, de principio a fin. Nunca había usado un buffer, y menos en TypeScript. Lo más cercano fue un proyecto corto con C. Primero hice todo con hex, daba errores, y cambié a una forma híbrida entre hex y utf-8. Que al final ni siquiera utilicé hex, pero la funcionalidad está ahí.

Primero intenté de a poco, pero como las pruebas no dan muchos outputs intermedios, tuve que hacer mis propios logs para saber qué estaba ocurriendo. Tampoco me sirvió mucho, la mayoría del debugging vino al final de tener la función terminada. Por suerte no tuve problema de la cantidad para reservar, fui muy prolijo ahí.


# Disclaimer
No use comentarios porque va en contra de clean code, en vez hice una documentación mas a fondo con explicaciones mas detalladas.

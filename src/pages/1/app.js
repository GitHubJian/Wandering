function add (arr) {
  arr.reduce((prev, cur) => {
    prev += cur

    return prev
  }, 0)
}

const sum = add([1, 2, 3, 4])

console.log('sum is ', sum)

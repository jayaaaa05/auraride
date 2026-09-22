/**
 * @file PriorityQueue.js
 * @description Custom Binary Min-Heap Priority Queue implementation (zero external dependencies).
 * Used by Dijkstra's Shortest Path algorithm and Greedy Driver Matcher.
 *
 * Time Complexity:
 * - enqueue(item, priority): O(log N) via bubbleUp
 * - dequeue(): O(log N) via siftDown
 * - peek(): O(1)
 * - isEmpty() / size(): O(1)
 * Space Complexity: O(N) where N is the number of elements in the heap.
 */

class PriorityQueue {
  constructor() {
    /** @type {Array<{item: any, priority: number}>} */
    this.heap = [];
  }

  /**
   * Number of elements currently in the priority queue.
   * @returns {number}
   */
  size() {
    return this.heap.length;
  }

  /**
   * Returns true if the priority queue contains no elements.
   * @returns {boolean}
   */
  isEmpty() {
    return this.heap.length === 0;
  }

  /**
   * Returns the minimum-priority element without removing it.
   * @returns {{item: any, priority: number} | null}
   */
  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  /**
   * Inserts an item with a numeric priority into the Min-Heap.
   * Lower priority values are dequeued first.
   * Time Complexity: O(log N)
   *
   * @param {any} item
   * @param {number} priority
   */
  enqueue(item, priority) {
    const node = { item, priority: Number(priority) };
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Extracts and returns the element with the lowest priority value.
   * Time Complexity: O(log N)
   *
   * @returns {{item: any, priority: number} | null}
   */
  dequeue() {
    if (this.isEmpty()) return null;
    if (this.heap.length === 1) {
      return this.heap.pop();
    }

    const minNode = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.siftDown(0);
    return minNode;
  }

  /**
   * Moves the element at `index` upward until the Min-Heap property is restored.
   * @param {number} index
   */
  bubbleUp(index) {
    let currentIndex = index;
    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);
      if (this.heap[currentIndex].priority >= this.heap[parentIndex].priority) {
        break;
      }
      this._swap(currentIndex, parentIndex);
      currentIndex = parentIndex;
    }
  }

  /**
   * Moves the element at `index` downward until the Min-Heap property is restored.
   * @param {number} index
   */
  siftDown(index) {
    let currentIndex = index;
    const length = this.heap.length;

    while (true) {
      const leftChildIdx = 2 * currentIndex + 1;
      const rightChildIdx = 2 * currentIndex + 2;
      let smallestIdx = currentIndex;

      if (
        leftChildIdx < length &&
        this.heap[leftChildIdx].priority < this.heap[smallestIdx].priority
      ) {
        smallestIdx = leftChildIdx;
      }

      if (
        rightChildIdx < length &&
        this.heap[rightChildIdx].priority < this.heap[smallestIdx].priority
      ) {
        smallestIdx = rightChildIdx;
      }

      if (smallestIdx === currentIndex) {
        break;
      }

      this._swap(currentIndex, smallestIdx);
      currentIndex = smallestIdx;
    }
  }

  /**
   * Swaps two elements in the internal heap array.
   * @param {number} i
   * @param {number} j
   */
  _swap(i, j) {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }

  /**
   * Returns a shallow copy of heap items sorted by priority (non-destructive).
   * @returns {Array<{item: any, priority: number}>}
   */
  toArray() {
    return [...this.heap].sort((a, b) => a.priority - b.priority);
  }
}

module.exports = PriorityQueue;

// A rejected operation must not prevent later work from running.
export class SerialQueue {
  tail = Promise.resolve();
  run(work) {
    const result = this.tail.then(work);
    this.tail = result.catch(() => {});
    return result;
  }
}

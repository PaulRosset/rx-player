/**
 * Copyright 2015 CANAL+ Group
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Observable } from "rxjs";
/**
 * Event sent when the corresponding task is a low-priority task that has just
 * been temporarly interrupted due to another task with a high priority.
 * The task will restart (from scratch) when tasks with more priority are
 * finished.
 */
export interface IInterruptedTaskEvent {
    type: "interrupted";
}
/** Event sent when the corresponding task emit an event. */
export interface ITaskDataEvent<T> {
    type: "data";
    value: T;
}
/**
 * Event sent when the corresponding task has ended (it will then complete).
 * You can use this event to schedule another task you wanted to perform after
 * that one.
 */
export interface IEndedTaskEvent {
    type: "ended";
}
/** Events sent when a task has been created through the `create` method. */
export declare type ITaskEvent<T> = IInterruptedTaskEvent | ITaskDataEvent<T> | IEndedTaskEvent;
/** Options to give to the ObservablePrioritizer. */
export interface IPrioritizerOptions {
    /** @see IPrioritizerPrioritySteps */
    prioritySteps: IPrioritizerPrioritySteps;
}
/**
 * Define both the `low` and `high` priority steps:
 *
 *   - Any Observable with a priority number that is lower or equal to the
 *     `high` value will be an Observable with high priority.
 *
 *     When Observables with high priorities are scheduled, they immediately
 *     abort pending Observables with low priorities (which will have then to
 *     wait until all higher-priority Observable have ended before re-starting).
 *
 *   - Any Observable with a priority number that is higher or equal to the
 *     `low` value will be an Observable with low priority.
 *
 *     Pending Observables with low priorities have the added particularity*
 *     of being aborted as soon as a high priority Observable is scheduled.
 *
 *     * Other pending Observables are not aborted when a higher-priority
 *     Observable is scheduled, as their priorities only affect them before
 *     they are started (to know when to start them).
 */
export interface IPrioritizerPrioritySteps {
    low: number;
    high: number;
}
/**
 * Create Observables which can be priorized between one another.
 *
 * With this class, you can link an Observables to a priority number.
 * The lower this number is, the more priority the resulting Observable will
 * have.
 *
 * Such returned Observables - called "tasks" - will then basically wait for
 * pending task with more priority (i.e. a lower priority number) to finish
 * before "starting".
 *
 * This only applies for non-pending tasks. For pending tasks, those are usually
 * not interrupted except in the following case:
 *
 * When a task with a "high priority" (which is a configurable priority
 * value) is created, pending tasks with a "low priority" (also configurable)
 * will be interrupted. Those tasks will be restarted when all tasks with a
 * higher priority are finished.
 *
 * You can also update the priority of an already-created task.
 *
 * ```js
 * const observable1 = Observable.timer(100).pipe(mapTo(1));
 * const observable2 = Observable.timer(100).pipe(mapTo(2));
 * const observable3 = Observable.timer(100).pipe(mapTo(3));
 * const observable4 = Observable.timer(100).pipe(mapTo(4));
 * const observable5 = Observable.timer(100).pipe(mapTo(5));
 *
 * // Instanciate ObservablePrioritizer.
 * // Also provide a `high` priority step - the maximum priority number a "high
 * // priority task" has and a `low` priority step - the minimum priority number
 * // a "low priority task" has.
 * const prioritizer = new ObservablePrioritizer({
 *   prioritySteps: { high: 0, low: 20 }
 * });
 *
 * const pObservable1 = prioritizer.create(observable1, 4);
 * const pObservable2 = prioritizer.create(observable2, 2);
 * const pObservable3 = prioritizer.create(observable3, 1);
 * const pObservable4 = prioritizer.create(observable4, 3);
 * const pObservable5 = prioritizer.create(observable5, 2);
 *
 * // start every Observables at the same time
 * observableMerge(
 *   pObservable1,
 *   pObservable2,
 *   pObservable3,
 *   pObservable4,
 *   pObservable5
 * ).subscribe((evt) => {
 *   if (evt.type === "data") {
 *     console.log(i);
 *
 *     // To spice things up, update pObservable1 priority to go before
 *     // pObservable4
 *     if (i === 5) { // if pObservable5 is currently emitting
 *       prioritizer.updatePriority(pObservable1, 1);
 *     }
 *   }
 * });
 *
 * // Result:
 * // 3
 * // 2
 * // 5
 * // 1
 * // 4
 *
 * // Note: here "1" goes before "4" only because the former's priority has been
 * // updated before the latter was started.
 * // It would be the other way around if not.
 * ```
 *
 * @class ObservablePrioritizer
 */
export default class ObservablePrioritizer<T> {
    /**
     * Priority of the most prioritary task currently running.
     * `null` if no task is currently running.
     */
    private _minPendingPriority;
    /** Queue of tasks currently waiting for more prioritary ones to finish. */
    private _waitingQueue;
    /** Tasks currently pending.  */
    private _pendingTasks;
    /** @see IPrioritizerPrioritySteps */
    private _prioritySteps;
    /**
     * @param {Options} prioritizerOptions
     */
    constructor({ prioritySteps }: IPrioritizerOptions);
    /**
     * Create a priorized Observable from a base Observable.
     *
     * When subscribed to, this Observable will have its priority compared to
     * all the already-running Observables created from this class.
     *
     * Only if this number is inferior or equal to the priority of the
     * currently-running Observables will it be immediately started.
     * In the opposite case, we will wait for higher-priority Observables to
     * finish before starting it.
     *
     * Note that while this Observable is waiting for its turn, it is possible
     * to update its property through the updatePriority method, by providing
     * the Observable returned by this function and its new priority number.
     *
     * @param {Observable} obs
     * @param {number} priority
     * @returns {Observable}
     */
    create(obs: Observable<T>, priority: number): Observable<ITaskEvent<T>>;
    /**
     * Update the priority of an Observable created through the `create` method.
     * @param {Observable} obs
     * @param {number} priority
     */
    updatePriority(obs: Observable<ITaskEvent<T>>, priority: number): void;
    /**
     * Interrupt and move back to the waiting queue all pending tasks that are
     * low priority (having a higher priority number than
     * `this._prioritySteps.low`).
     */
    private _interruptCancellableTasks;
    /**
     * Start task which is at the given index in the waiting queue.
     * The task will be removed from the waiting queue in the process.
     * @param {number} index
     */
    private _startTask;
    /**
     * Move back pending task to the waiting queue and interrupt it.
     * @param {object} task
     */
    private _interruptPendingTask;
    /**
     * Logic ran when a task begin.
     * @param {Object} task
     */
    private _onTaskBegin;
    /**
     * Logic ran when a task has ended.
     * @param {Object} task
     */
    private _onTaskEnd;
    /**
     * Return `true` if the given task can be started immediately based on its
     * priority.
     * @param {Object} task
     * @returns {boolean}
     */
    private _canBeStartedNow;
    /**
     * Returns `true` if the given task can be considered "high priority".
     * returns false otherwise.
     * @param {Object} task
     * @returns {boolean}
     */
    private _isHighPriority;
}

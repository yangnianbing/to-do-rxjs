const {fromEvent} = require('rxjs');
const {startWith, scan, map, merge, combineLatest,  pairwise,filter} = require('rxjs/operators');
const util = require('@yangnb/jsutil_')
const h = require('snabbdom/h').default;
const {div, h2, p, li, ul, a, span, input, section} = require('hyperscript-helpers')(h);

const snabbdom = require('snabbdom');
const classModule = require('snabbdom/modules/class').default;
const propsModule = require('snabbdom/modules/props').default;
const styleModule = require('snabbdom/modules/style').default;
const attrsModule = require('snabbdom/modules/attributes').default;
const patch = snabbdom.init([classModule, propsModule, styleModule, attrsModule]);

function intent($container){
    var source$ = fromEvent($container, 'click');
    var input$ = fromEvent($container, 'keydown').pipe(filter(e => e.target.classList.contains('content')), map(e => {
        var rowEl = util.getParents(e.target, 'row')
        return {
            type: 'input',
            id: rowEl.dataset.id,
            content: e.target.value,
        }
    }))

    var done$ = source$.pipe(filter(e => {
        return e.target.classList.contains('done');
    }), map(e => {
        var rowEl = util.getParents(e.target, 'row')
        return {
            type: 'done',
            id: rowEl.dataset.id
        }
    }))

    var add$ = source$.pipe(filter(e => {
        return e.target.classList.contains('add')
    }), map(e => {
        return {
            type: 'add'
        }
    }))


    var remove$ = source$.pipe(filter(e => {
        return e.target.classList.contains('remove');
    }), map(e => {
        var rowEl = util.getParents(e.target, 'row');
        return {
            type: 'remove',
            id: rowEl.dataset.id
        }
    }))

    var top$ = source$.pipe(filter(e => e.target.classList.contains('top')), map(e => {
        var rowEl = util.getParents(e.target, 'row');
        return {
            type: 'top',
            id: rowEl.dataset.id
        }
    }))

    return done$.pipe(merge(add$, remove$, top$, input$));
}

function model(action$){
    var initialState = util.getLocalStorageItem('todoCache');
    !initialState && (initialState = {records:[]});
    const doneReducer$ = action$.pipe(filter(action => action.type === 'done'), map(action => function(state){
        state.records.filter(
            record => 
                record.id === Number(action.id)
        ).forEach(
            record => 
                record.done = !record.done
        );
        return state;
    }))

    const removeReducer$ =  action$.pipe(filter(action => action.type === 'remove'), map(action => function(state){
        util.remove(state.records, (record) => record.id === Number(action.id))
        return state;
    }))

    const addReducer$ = action$.pipe(filter(action => action.type === 'add'), map(action => function(state){
        state.records.push({id:new Date().valueOf(), done: false, content: ''})
        return state;
    }))
    
    const topReducer$ = action$.pipe(filter(action => action.type === 'top'), map(action => function(state){
        util.putHead(state.records, (record) => record.id === Number(action.id));
        return state;
    }))

    const inputReducer$ = action$.pipe(filter(action => action.type === 'input'), map(action => function(state){
        state.records.forEach(record => {
            if(record.id === Number(action.id)){
                record.content = action.content;
            }
        })
        return state;
    }))

    return doneReducer$.pipe(merge(removeReducer$, addReducer$, topReducer$, inputReducer$), scan((state, reducer) => {
        return reducer(state);
    }, initialState), startWith(initialState))
}


function view(viewState$){
    return viewState$.pipe(map(state => {
        util.setLocalStorageItem('todoCache', state);
        return div('.to-do-container', [
            section('.header', h2(['待办事项', span('.add', '添加')])),
            section('.content', ul('.list', state.records.map(renderItem)))
        ])
    }))
}


function renderItem(record){
    return li('.row',  {attrs: {'data-id': record.id}}, [
        span('.done.iconfont', {class: {'icon-check': record.done, 'icon-uncheck': !record.done}}),
        input('.content', {props: {value:record.content}}),
        div('.operator', [
            span('.top.operator-btn.iconfont.icon-zhiding1', {attrs: {title: '置顶'}}),
            span('.remove.operator-btn.iconfont.icon-remove', {attrs: {title: '删除'}}),
            span('.move.operator-btn.iconfont.icon-move', {style: {cursor:'move'}, attrs: {title: '移动'}})
        ])
    ])
}

function main(container){
    var action$ = intent(container);
    var state$ = model(action$);
    var dom$ = view(state$);
    return {
        DOM: dom$
    }
}

main(document.querySelector('.to-do-container')).DOM.pipe(startWith(document.querySelector('.to-do-container')), pairwise()).subscribe(([a, b]) => {
    patch(a, b)
});


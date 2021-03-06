const ProfitTableUI        = require('./profit_table.ui');
const ViewPopupWS          = require('../../view_popup/view_popupws');
const localize             = require('../../../../base/localize').localize;
const showLocalTimeOnHover = require('../../../../base/clock').showLocalTimeOnHover;
const addTooltip           = require('../../../../common_functions/get_app_details').addTooltip;
const buildOauthApps       = require('../../../../common_functions/get_app_details').buildOauthApps;
const Content              = require('../../../../common_functions/content').Content;

const ProfitTableInit = (() => {
    let batch_size,
        chunk_size,
        transactions_received,
        transaction_consumed,
        no_more_data,
        pending,
        current_batch;

    const tableExist = () => (document.getElementById('profit-table'));

    const finishedConsumed = () => (transaction_consumed === transactions_received);

    const onUnload = () => {
        current_batch = [];
        transaction_consumed = 0;
        transactions_received = 0;
        pending = false;

        ProfitTableUI.errorMessage(null);

        if (tableExist()) {
            ProfitTableUI.cleanTableContent();
        }
    };

    const getNextBatchTransactions = () => {
        getProfitTable({ offset: transactions_received, limit: batch_size });
        pending = true;
    };

    const getNextChunk = () => {
        const chunk = current_batch.splice(0, chunk_size);
        transaction_consumed += chunk.length;
        return chunk;
    };

    const profitTableHandler = (response) => {
        if (response.error) {
            ProfitTableUI.errorMessage(response.error.message);
            return;
        }

        pending = false;
        const profit_table = response.profit_table;
        current_batch = profit_table.transactions;
        transactions_received += current_batch.length;

        if (current_batch.length < batch_size) {
            no_more_data = true;
        }

        if (!tableExist()) {
            ProfitTableUI.createEmptyTable().appendTo('#profit-table-ws-container');
            ProfitTableUI.updateProfitTable(getNextChunk());

            // Show a message when the table is empty
            if ((transactions_received === 0) && (current_batch.length === 0)) {
                $('#profit-table').find('tbody')
                    .append($('<tr/>', { class: 'flex-tr' })
                        .append($('<td/>',  { colspan: 8 })
                            .append($('<p/>', { class: 'notice-msg center-text', text: localize('Your account has no trading activity.') }))));
            }
        }
    };

    const onScrollLoad = () => {
        $(document).scroll(() => {
            const hidableHeight = (percentage) => {
                const totalHidable = $(document).height() - $(window).height();
                return Math.floor((totalHidable * percentage) / 100);
            };

            const p_from_top = $(document).scrollTop();

            if (!tableExist() || p_from_top < hidableHeight(50)) {
                return;
            }

            if (finishedConsumed() && !no_more_data && !pending) {
                getNextBatchTransactions();
                return;
            }

            if (!finishedConsumed()) {
                ProfitTableUI.updateProfitTable(getNextChunk());
            }
        });
    };

    const getProfitTable = (opts) => {
        const req = { profit_table: 1, description: 1 };

        if (opts) $.extend(true, req, opts);

        BinarySocket.send(req).then((response) => {
            profitTableHandler(response);
            showLocalTimeOnHover('td.buy-date,td.sell-date');
            $('.barspinner').addClass('hidden');
        });
    };

    const onLoad = () => {
        batch_size = 100;
        chunk_size = batch_size / 2;
        transactions_received = 0;
        transaction_consumed = 0;
        no_more_data = false;
        pending = false;
        current_batch = [];

        BinarySocket.send({ oauth_apps: 1 }).then((response) => {
            addTooltip(ProfitTableUI.setOauthApps(buildOauthApps(response)));
        });
        Content.populate();
        getNextBatchTransactions();
        onScrollLoad();
        ViewPopupWS.viewButtonOnClick('#profit-table-ws-container');
    };

    return {
        profitTableHandler: profitTableHandler,
        onLoad            : onLoad,
        onUnload          : onUnload,
    };
})();

module.exports = ProfitTableInit;

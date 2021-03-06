import React, {Component} from "react";

import {Modal, Form, FormControl} from "react-bootstrap";

import {Global} from "../../store/global/types";
import {Account} from "../../store/accounts/types";
import {Entry, EntryVote} from "../../store/entries/types";
import {User} from "../../store/users/types";
import {ActiveUser} from "../../store/active-user/types";
import {DynamicProps} from "../../store/dynamic-props/types";
import {UI, ToggleType} from "../../store/ui/types";

import FormattedCurrency from "../formatted-currency";
import LoginRequired from "../login-required";
import {error} from "../feedback";

import {votingPower} from "../../api/hive";
import {vote, formatError} from "../../api/operations";

import parseAsset from "../../helper/parse-asset";

import * as ls from "../../util/local-storage";

import _c from "../../util/fix-class-names";

import {chevronUpSvg} from "../../img/svg";

const setVoteValue = (type: "up" | "down", username: string, value: number) => {
    ls.set(`vote-value-${type}-${username}`, value);
};

const getVoteValue = (type: "up" | "down", username: string, def: number): number => {
    return ls.get(`vote-value-${type}-${username}`, def);
};

type Mode = "up" | "down";

interface VoteDialogProps {
    global: Global;
    activeUser: ActiveUser;
    dynamicProps: DynamicProps;
    entry: Entry;
    onClick: (percent: number) => void;
}

interface VoteDialogState {
    upSliderVal: number;
    downSliderVal: number;
    estimated: number;
    mode: Mode;
}

export class VoteDialog extends Component<VoteDialogProps, VoteDialogState> {
    state: VoteDialogState = {
        upSliderVal: getVoteValue("up", this.props.activeUser?.username!, 100),
        downSliderVal: getVoteValue("down", this.props.activeUser?.username!, -100),
        estimated: 0,
        mode: "up",
    };

    estimate = (percent: number): number => {
        const {entry, activeUser, dynamicProps} = this.props;
        if (!activeUser) {
            return 0;
        }

        const {fundRecentClaims, fundRewardBalance, base, quote} = dynamicProps;
        const {data: account} = activeUser;

        if (!account.__loaded) {
            return 0;
        }

        const sign = percent < 0 ? -1 : 1;
        const postRshares = entry.net_rshares;

        const totalVests =
            parseAsset(account.vesting_shares).amount +
            parseAsset(account.received_vesting_shares).amount -
            parseAsset(account.delegated_vesting_shares).amount;

        const userVestingShares = totalVests * 1e6;

        const userVotingPower = votingPower(account) * Math.abs(percent);
        const voteEffectiveShares = userVestingShares * (userVotingPower / 10000) * 0.02;

        // reward curve algorithm (no idea whats going on here)
        const CURVE_CONSTANT = 2000000000000;
        const CURVE_CONSTANT_X4 = 4 * CURVE_CONSTANT;
        const SQUARED_CURVE_CONSTANT = CURVE_CONSTANT * CURVE_CONSTANT;

        const postRsharesNormalized = postRshares + CURVE_CONSTANT;
        const postRsharesAfterVoteNormalized = postRshares + voteEffectiveShares + CURVE_CONSTANT;
        const postRsharesCurve = (postRsharesNormalized * postRsharesNormalized - SQUARED_CURVE_CONSTANT) / (postRshares + CURVE_CONSTANT_X4);
        const postRsharesCurveAfterVote = (postRsharesAfterVoteNormalized * postRsharesAfterVoteNormalized - SQUARED_CURVE_CONSTANT) /
            (postRshares + voteEffectiveShares + CURVE_CONSTANT_X4);

        const voteClaim = postRsharesCurveAfterVote - postRsharesCurve;

        const proportion = voteClaim / fundRecentClaims;
        const fullVote = proportion * fundRewardBalance;

        const voteValue = fullVote * (base / quote);

        if (sign > 0) {
            return Math.max(voteValue * sign, 0);
        }

        return voteValue * sign;
    };

    upSliderChanged = (e: React.ChangeEvent<FormControl & HTMLInputElement>) => {
        const upSliderVal = Number(e.target.value);
        this.setState({upSliderVal});

        const {activeUser} = this.props;
        setVoteValue("up", activeUser?.username!, upSliderVal);
    };

    downSliderChanged = (e: React.ChangeEvent<FormControl & HTMLInputElement>) => {
        const downSliderVal = Number(e.target.value);
        this.setState({downSliderVal});

        const {activeUser} = this.props;
        setVoteValue("down", activeUser?.username!, downSliderVal);
    };

    changeMode = (m: Mode) => {
        this.setState({mode: m});
    };

    upVoteClicked = () => {
        const {onClick} = this.props;
        const {upSliderVal} = this.state;
        onClick(upSliderVal);
    };

    downVoteClicked = () => {
        const {onClick} = this.props;
        const {downSliderVal} = this.state;
        onClick(downSliderVal);
    };

    render() {
        const {upSliderVal, downSliderVal, mode} = this.state;

        return (
            <>
                {mode === "up" && (
                    <div className="voting-controls voting-controls-up">
                        <div className="btn-vote btn-up-vote vote-btn-lg" onClick={this.upVoteClicked}>
                            <span className="btn-inner">{chevronUpSvg}</span>
                        </div>
                        <div className="estimated">
                            <FormattedCurrency {...this.props} value={this.estimate(upSliderVal)} fixAt={3}/>
                        </div>
                        <div className="slider slider-up">
                            <Form.Control
                                autoFocus={true}
                                type="range"
                                custom={true}
                                step={0.1}
                                min={0}
                                max={100}
                                value={upSliderVal}
                                onChange={this.upSliderChanged}
                            />
                        </div>
                        <div className="percentage">{`${upSliderVal.toFixed(1)}%`}</div>
                        <div
                            className="btn-vote btn-down-vote vote-btn-lg"
                            onClick={() => {
                                this.changeMode("down");
                            }}>
                            <span className="btn-inner">{chevronUpSvg}</span>
                        </div>
                    </div>
                )}

                {mode === "down" && (
                    <div className="voting-controls voting-controls-down">
                        <div
                            className="btn-vote btn-up-vote vote-btn-lg"
                            onClick={() => {
                                this.changeMode("up");
                            }}>
                            <span className="btn-inner">{chevronUpSvg}</span>
                        </div>
                        <div className="estimated">
                            <FormattedCurrency {...this.props} value={this.estimate(downSliderVal)} fixAt={3}/>
                        </div>
                        <div className="slider slider-down">
                            <Form.Control
                                type="range"
                                custom={true}
                                step={0.1}
                                min={-100}
                                max={-0.1}
                                value={downSliderVal}
                                onChange={this.downSliderChanged}
                            />
                        </div>
                        <div className="percentage">{`${downSliderVal.toFixed(1)}%`}</div>
                        <div className="btn-vote btn-down-vote vote-btn-lg" onClick={this.downVoteClicked}>
                            <span className="btn-inner">{chevronUpSvg}</span>
                        </div>
                    </div>
                )}
            </>
        );
    }
}

interface Props {
    global: Global;
    dynamicProps: DynamicProps;
    entry: Entry;
    users: User[];
    activeUser: ActiveUser | null;
    ui: UI;
    setActiveUser: (username: string | null) => void;
    updateActiveUser: (data?: Account) => void;
    deleteUser: (username: string) => void;
    toggleUIProp: (what: ToggleType) => void;
    afterVote: (votes: EntryVote[]) => void;
}

interface State {
    dialog: boolean;
    inProgress: boolean;
}

export class EntryVoteBtn extends Component<Props, State> {
    state: State = {
        dialog: false,
        inProgress: false,
    };

    _mounted: boolean = true;

    componentWillUnmount() {
        this._mounted = false;
    }

    stateSet = (state: {}, cb?: () => void) => {
        if (this._mounted) {
            this.setState(state, cb);
        }
    };

    vote = (percent: number) => {
        this.toggleDialog();

        const {entry, activeUser, afterVote, updateActiveUser} = this.props;
        const weight = Math.ceil(percent * 100);

        this.stateSet({inProgress: true});
        const username = activeUser?.username!;

        vote(username, entry.author, entry.permlink, weight)
            .then(() => {
                const votes: EntryVote[] = [
                    ...entry.active_votes.filter((x) => x.voter !== username),
                    {rshares: weight, voter: username}
                ];

                afterVote(votes);
                updateActiveUser(); // refresh voting power
            })
            .catch((e) => {
                error(formatError(e));
            })
            .finally(() => {
                this.stateSet({inProgress: false});
            });
    };

    isVoted = () => {
        const {activeUser} = this.props;

        if (!activeUser) {
            return {upVoted: false, downVoted: false};
        }

        const {active_votes: votes} = this.props.entry;

        const upVoted = votes.some((v) => v.voter === activeUser.username && v.rshares > 0);

        const downVoted = votes.some((v) => v.voter === activeUser.username && v.rshares < 0);

        return {upVoted, downVoted};
    };

    toggleDialog = () => {
        const {dialog} = this.state;
        this.stateSet({dialog: !dialog});
    };

    render() {
        const {activeUser} = this.props;
        const {dialog, inProgress} = this.state;
        const {upVoted, downVoted} = this.isVoted();

        let cls = _c(`btn-vote btn-up-vote ${inProgress ? "in-progress" : ""}`);

        if (upVoted || downVoted) {
            cls = _c(`btn-vote ${upVoted ? "btn-up-vote" : "btn-down-vote"} ${inProgress ? "in-progress" : ""} voted`);
        }

        return (
            <>
                {LoginRequired({
                    ...this.props,
                    children: <div className="entry-vote-btn" onClick={this.toggleDialog}>
                        <div className={cls}>
                            <span className="btn-inner">{chevronUpSvg}</span>
                        </div>
                    </div>
                })}

                {(dialog && activeUser) && (
                    <Modal className="vote-modal" onHide={this.toggleDialog} show={true} centered={true} animation={false}>
                        <VoteDialog {...this.props} activeUser={activeUser} onClick={this.vote}/>
                    </Modal>
                )}
            </>
        );
    }
}


export default (p: Props) => {
    const props = {
        global: p.global,
        dynamicProps: p.dynamicProps,
        entry: p.entry,
        users: p.users,
        activeUser: p.activeUser,
        ui: p.ui,
        setActiveUser: p.setActiveUser,
        updateActiveUser: p.updateActiveUser,
        deleteUser: p.deleteUser,
        toggleUIProp: p.toggleUIProp,
        afterVote: p.afterVote,
    }

    return <EntryVoteBtn {...props} />
}

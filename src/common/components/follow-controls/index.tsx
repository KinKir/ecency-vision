import React, {Component} from "react";

import {Button} from "react-bootstrap";

import {Account} from "../../store/accounts/types";
import {User} from "../../store/users/types";
import {ActiveUser} from "../../store/active-user/types";
import {UI, ToggleType} from "../../store/ui/types";

import LoginRequired from "../login-required";
import {error} from "../feedback";

import {getRelationshipBetweenAccounts} from "../../api/bridge";
import {follow, unFollow, ignore, formatError} from "../../api/operations";

import {_t} from "../../i18n";


interface Props {
    users: User[];
    activeUser: ActiveUser | null;
    ui: UI;
    targetUsername: string;
    setActiveUser: (username: string | null) => void;
    updateActiveUser: (data?: Account) => void;
    deleteUser: (username: string) => void;
    toggleUIProp: (what: ToggleType) => void;
}

interface State {
    fetching: boolean,
    inProgress: boolean,
    following: boolean,
    muted: boolean
}

export default class FollowControls extends Component<Props, State> {
    state: State = {
        fetching: false,
        inProgress: false,
        following: false,
        muted: false
    }

    _mounted: boolean = true;

    componentDidMount() {
        this.fetch().then();
    }

    componentWillUnmount() {
        this._mounted = false;
    }

    componentDidUpdate(prevProps: Readonly<Props>) {
        if (
            // active user changed
            (prevProps.activeUser?.username !== this.props.activeUser?.username) ||
            // or target account username changed
            (prevProps.targetUsername !== this.props.targetUsername)
        ) {
            this.fetch().then()
        }
    }

    stateSet = (state: {}, cb?: () => void) => {
        if (this._mounted) {
            this.setState(state, cb);
        }
    };

    fetch = async () => {
        this.stateSet({
            fetching: true,
            inProgress: false,
            following: false,
            muted: false
        })

        const {activeUser, targetUsername} = this.props;

        if (!activeUser) {
            this.stateSet({fetching: false});
            return;
        }

        getRelationshipBetweenAccounts(activeUser.username, targetUsername).then(r => {
            if (r) {
                this.stateSet({following: r.follows, muted: r.ignores});
            }
        }).finally(() => {
            this.stateSet({fetching: false});
        })
    }

    follow = async () => {
        const {activeUser, targetUsername} = this.props;

        this.stateSet({inProgress: true});
        try {
            await follow(activeUser?.username!, targetUsername);
            this.stateSet({following: true, muted: false});
        } catch (err) {
            error(formatError(err));
        } finally {
            this.stateSet({inProgress: false});
        }
    };

    unFollow = async () => {
        const {activeUser, targetUsername} = this.props;

        this.stateSet({inProgress: true});
        try {
            await unFollow(activeUser?.username!, targetUsername);
            this.stateSet({following: false, muted: false});
        } catch (err) {
            error(formatError(err));
        } finally {
            this.stateSet({inProgress: false});
        }
    };

    mute = async () => {
        const {activeUser, targetUsername} = this.props;

        this.stateSet({inProgress: true});
        try {
            await ignore(activeUser?.username!, targetUsername);
            this.stateSet({following: false, muted: true});
        } catch (err) {
            error(formatError(err));
        } finally {
            this.stateSet({inProgress: false});
        }
    };

    render() {
        const {following, muted, fetching, inProgress} = this.state;

        const followMsg = _t('follow-controls.follow');
        const unFollowMsg = _t('follow-controls.unFollow');
        const muteMsg = _t('follow-controls.mute');
        const unMuteMsg = _t('follow-controls.unMute');

        const btnFollow = LoginRequired({
            ...this.props,
            children: <Button
                variant="primary"
                style={{marginRight: '5px'}}
                disabled={inProgress}
                onClick={this.follow}
            >
                {followMsg}
            </Button>
        });

        const btnUnfollow = LoginRequired({
            ...this.props,
            children: <Button
                variant="primary"
                style={{marginRight: '5px'}}
                disabled={inProgress}
                onClick={this.unFollow}
            >
                {unFollowMsg}
            </Button>
        });

        const btnMute = LoginRequired({
            ...this.props,
            children: <Button disabled={inProgress} onClick={this.mute}>
                {muteMsg}
            </Button>
        });

        const btnUnMute = LoginRequired({
            ...this.props,
            children: <Button disabled={inProgress} onClick={this.unFollow}>
                {unMuteMsg}
            </Button>
        });

        if (fetching) {
            return (
                <>
                    <Button variant="primary" disabled={true} style={{marginRight: '5px'}}>
                        {followMsg}
                    </Button>
                    <Button disabled={true}>{muteMsg}</Button>
                </>
            );
        }

        if (following) {
            return (
                <>
                    {btnUnfollow}
                    {btnMute}
                </>
            );
        }

        if (muted) {
            return (
                <>
                    {btnFollow}
                    {btnUnMute}
                </>
            );
        }

        return (
            <>
                {btnFollow}
                {btnMute}
            </>
        );
    }
}

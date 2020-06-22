import React, { Component } from "react";

import { History } from "history";

import isEqual from "react-fast-compare";

import { FormControl } from "react-bootstrap";

import { ReactSortable, ItemInterface } from "react-sortablejs";

import { Global } from "../../store/global/types";
import { TrendingTags } from "../../store/trending-tags/types";

import Tag from "../tag";
import SuggestionList from "../suggestion-list";
import { error } from "../feedback";

import { _t } from "../../i18n";

import _c from "../../util/fix-class-names";

import { closeSvg, accountGroupSvg, poundSvg } from "../../img/svg";

interface Props {
  global: Global;
  history: History;
  trendingTags: TrendingTags;
  tags: string[];
  maxItem: number;
  onChange: (tags: string[]) => void;
}

interface State {
  hasFocus: boolean;
  value: string;
}

export default class TagSelector extends Component<Props, State> {
  state: State = {
    hasFocus: false,
    value: "",
  };

  shouldComponentUpdate(nextProps: Readonly<Props>, nextState: Readonly<{}>): boolean {
    return !isEqual(this.props.tags, nextProps.tags) || !isEqual(this.state, nextState);
  }

  focusInput = () => {
    const input = document.getElementById("the-tag-input");
    input?.focus();
  };

  onFocus = () => {
    this.setState({ hasFocus: true });
  };

  onBlur = () => {
    this.setState({ hasFocus: false });
  };

  onChange = (e: React.ChangeEvent<FormControl & HTMLInputElement>) => {
    const value = e.target.value.toLocaleLowerCase().trim();
    this.setState({ value });
  };

  onKeyDown = (e: React.KeyboardEvent) => {
    if (e.keyCode === 13) {
      const { value } = this.state;
      this.add(value);
    }
  };

  add = (value: string): boolean => {
    const { tags, maxItem, onChange } = this.props;

    if (value === "") {
      return false;
    }

    if (tags.includes(value)) {
      return false;
    }

    if (tags.length >= maxItem) {
      error(_t("tag-selector.error-max", { n: maxItem }));
      return false;
    }

    const newTags = [...tags, value];
    onChange(newTags);

    this.setState({ value: "" });
    return true;
  };

  delete = (tag: string) => {
    const { tags, onChange } = this.props;
    const newTags = tags.filter((x) => x !== tag);
    onChange(newTags);
  };

  onSort = (items: ItemInterface[]) => {
    const { onChange } = this.props;
    const newTags = items.map((x: ItemInterface) => x.name);
    onChange(newTags);
  };

  render() {
    const { tags, trendingTags } = this.props;
    const { hasFocus, value } = this.state;
    const placeholder =
      tags.length > 0
        ? _t("tag-selector.placeholder-has-tags")
        : hasFocus
        ? _t("tag-selector.placeholder-focus")
        : _t("tag-selector.placeholder-empty");

    let suggestions: string[] = [];

    if (value) {
      suggestions = trendingTags.list
        .filter((x: string) => x.toLowerCase().indexOf(value.toLowerCase()) === 0)
        .filter((x: string) => !tags.includes(x))
        .slice(0, 40);
    }

    return (
      <>
        <div className={_c(`tag-selector ${tags.length > 0 ? "has-tags" : ""}`)}>
          <SuggestionList
            renderer={(x: string) => {
              if (x.startsWith("hive-")) {
                return (
                  <>
                    {accountGroupSvg}
                    <Tag type="span" {...this.props} tag={x}>
                      <span>{x}</span>
                    </Tag>
                    <span className="flex-spacer" />
                    <small>{x}</small>
                  </>
                );
              }
              return (
                <>
                  {poundSvg} {x}
                </>
              );
            }}
            items={suggestions}
            header={_t("tag-selector.suggestion-header")}
            onSelect={(value: string) => {
              if (this.add(value)) {
                setTimeout(() => {
                  // delay focus due to click out issue on suggestion list
                  this.focusInput();
                }, 200);
              }
            }}
          >
            <FormControl
              type="text"
              onFocus={this.onFocus}
              onBlur={this.onBlur}
              onKeyDown={this.onKeyDown}
              onChange={this.onChange}
              value={value}
              maxLength={24}
              placeholder={placeholder}
              autoComplete="off"
              id="the-tag-input"
            />
          </SuggestionList>
          {tags.length > 0 && (
            <ReactSortable
              animation={200}
              swapThreshold={1}
              ghostClass="tag-item-ghost"
              className="tag-list"
              list={[...tags.map((x) => ({ id: x, name: x }))]}
              setList={this.onSort}
            >
              {tags.map((x) => {
                return (
                  <div key={x} className="tag-item">
                    <div className="item-inner">
                      <Tag {...this.props} tag={x}>
                        <span>{x}</span>
                      </Tag>
                    </div>
                    <span
                      className="item-delete"
                      onClick={() => {
                        this.delete(x);
                      }}
                    >
                      {closeSvg}
                    </span>
                  </div>
                );
              })}
            </ReactSortable>
          )}
        </div>
      </>
    );
  }
}
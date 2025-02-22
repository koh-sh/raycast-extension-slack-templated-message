import React from "react";
import { withAccessToken } from "@raycast/utils";
import { slack } from "../utils/slack";
import { TemplateForm } from "../components/TemplateForm";

function Command() {
  return <TemplateForm />;
}

export default withAccessToken(slack)(Command);

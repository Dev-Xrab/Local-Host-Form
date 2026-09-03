import OptionList from "./OptionList";

export default function MultipleChoice({ question }) {
  return <OptionList question={question} variant="radio" />;
}

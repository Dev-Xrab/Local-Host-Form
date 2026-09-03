import { useLocation } from "react-router-dom"
import FormInfo from "../../components/FormComponents/FormInfo/FormInfo"
import Sidebar from "../../components/FormComponents/Sidebar/Sidebar"
import Question from "../../components/FormComponents/Question/Question"
import Section from "../../components/FormComponents/Section/Section"
import WindowContainer from "../../components/Window Container/WindowContainer"
import SessionsPage from "./SessionsPage"
import SettingsPage from "./SettingsPage"
import useFormStore from "../../../store/useFormStore"
import "./form-page.css"

export default function FormPage(){
    const questions = useFormStore((s) => s.questions);
    const location = useLocation();

    const getPageContent = () => {
        const pathname = location.pathname;

        if (pathname === "/sessions") {
            return <SessionsPage />;
        } else if (pathname === "/settings") {
            return <SettingsPage />;
        } else {
            return (
                <div className="page-form-column">
                    <WindowContainer component={<FormInfo/>} navigationpath="Form Info"/>

                    {(() => {
                        let questionNumber = 0;
                        return questions.map((question, index) => {
                            const isFirst = index === 0;
                            const isLast = index === questions.length - 1;

                            if (question.type === "section") {
                                return (
                                    <Section
                                        key={question.id}
                                        section={question}
                                        isFirst={isFirst}
                                        isLast={isLast}
                                    />
                                );
                            }

                            questionNumber += 1;
                            return (
                                <Question
                                    key={question.id}
                                    question={question}
                                    index={questionNumber - 1}
                                    isFirst={isFirst}
                                    isLast={isLast}
                                />
                            );
                        });
                    })()}

                    {questions.length === 0 && (
                        <p className="page-form-empty-hint">
                            Use the sidebar to add your first question.
                        </p>
                    )}
                </div>
            );
        }
    };

    return(
        <div className="form-page">
            <Sidebar/>

            <div className="page-form-content">
                {getPageContent()}
            </div>
        </div>
    )
}

import { useEffect, useState, useContext } from 'preact/hooks';
import * as api from "../../api";
import DOMPurify from "dompurify";
import { AppState } from '../../state.js';

export function Form() {
    const [generated, setGenerated] = useState("");
    const state = useContext(AppState);
    const task = state.selected_task.value

    // no embedded form and no Camunda form, we have to look for generated form
    useEffect(() => {
        if (!task.formKey && !task.camundaFormRef && task.id) {
            api.get_generated_form(state, task.id)
                .then((html) => {
                    setGenerated( parseHtml(html) );
                });
        }
    }, [task]);

    return (
        <>
            {(() => {
                if (task.formKey) {
                    const formLink = task.formKey.substring(13);

                    return ( // TODO needs to be clarified what to do here
                        <>
                            <a href={`http://localhost:8888/${formLink}`} target="_blank">Embedded Form</a>
                        </>
                    );
                } else if (task.camundaFormRef) {

                } else {
                    return <div class="generated-form" dangerouslySetInnerHTML={{ __html: generated }} />;
                }

            })()}
        </>
    );
}

/* remove unnecessary JS code, set date type for date inputs and add form buttons */
function parseHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const fields = doc.getElementsByTagName("input");

    // if we have a date, we change the input type to date, so the standard datepicker can be used
    for (const field of fields) {
        if (field.hasAttribute("uib-datepicker-popup")) {
            field.type = "date";
        }
    }

    // add 2 buttons to the form
    const formField = doc.getElementsByTagName("form");
    if (formField.length > 0) {
        const buttonNode = document.createElement("button");
        const textnode = document.createTextNode("Complete Task");
        buttonNode.appendChild(textnode);

        const buttonNode2 = document.createElement("button");
        const textnode2 = document.createTextNode("Save Form");
        buttonNode2.appendChild(textnode2);
        buttonNode2.setAttribute("class", "secondary")

        const node = document.createElement("div");
        node.appendChild(buttonNode);
        node.appendChild(buttonNode2);
        node.setAttribute("class", "form-buttons")
        formField[0].appendChild(node);
    }

    // we clean up the HTML, will remove unnecessary JS
    return DOMPurify.sanitize(doc.documentElement.outerHTML);
}
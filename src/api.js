import {signal, effect} from "@preact/signals";

const base_url = "http://localhost:8888/engine-rest";

const get_process_definitions = () =>
    fetch(base_url + "/process-definition/statistics").then((response) =>
        response.json(),
    );

const get_process_definition = (id) =>
    fetch(base_url + "/process-definition/" + id).then((response) =>
        response.json(),
    );

const get_process_instance_list = (defintion_id) =>
    fetch(
        base_url +
        "/history/process-instance?" +
        new URLSearchParams({
            unfinished: true,
            sortBy: "startTime",
            sortOrder: "asc",
            processDefinitionId: defintion_id,
        }).toString(),
    ).then((response) => response.json());


const get_process_instance = (instance_id) =>
    fetch(
        `${base_url}/process-instance/${instance_id}`
    ).then((response) => response.json());

const get_process_instance_variables = (instance_id) =>
    fetch(
        `${base_url}/process-instance/${instance_id}/variables`
    ).then((response) => response.json());


const get_diagram = (definition_id) =>
    fetch(
        `${base_url}/process-definition/${definition_id}/xml`
    ).then(response => response.json())

export {
    get_process_definitions,
    get_process_definition,
    get_diagram,
    get_process_instance_list,
    get_process_instance,
    get_process_instance_variables
};
